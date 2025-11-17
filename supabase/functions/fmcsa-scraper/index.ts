import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ScrapeRequest {
  start_point: number;
  records: number;
  carriers: boolean;
  brokers: boolean;
  authorized: boolean;
  standard: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.subscription_status === 'inactive') {
      return new Response(
        JSON.stringify({ error: 'No active subscription' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.subscription_end_date && new Date(profile.subscription_end_date) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Subscription expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: ScrapeRequest = await req.json();

    if (profile.records_remaining < requestData.records) {
      return new Response(
        JSON.stringify({ error: 'Insufficient records remaining', remaining: profile.records_remaining }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('scrape_jobs')
      .insert({
        user_id: user.id,
        start_point: requestData.start_point,
        records: requestData.records,
        carriers: requestData.carriers,
        brokers: requestData.brokers,
        authorized: requestData.authorized,
        standard: requestData.standard,
        status: 'processing'
      })
      .select()
      .maybeSingle();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Failed to create job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting scrape job ${job.id} for MC ${requestData.start_point}-${requestData.start_point + requestData.records}`);

    EdgeRuntime.waitUntil(
      (async () => {
        try {
          console.log(`Processing job ${job.id}...`);
          const results = await scrapeFMCSAData(requestData);
          
          console.log(`Job ${job.id} completed with ${results.length} records`);
          
          await supabase
            .from('scrape_jobs')
            .update({
              status: 'completed',
              result_data: results,
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          await supabase
            .from('profiles')
            .update({
              records_remaining: profile.records_remaining - requestData.records
            })
            .eq('id', user.id);

          console.log(`Job ${job.id} saved successfully`);
        } catch (error) {
          console.error(`Job ${job.id} failed:`, error);
          await supabase
            .from('scrape_jobs')
            .update({ status: 'failed' })
            .eq('id', job.id);
        }
      })()
    );

    return new Response(
      JSON.stringify({ job_id: job.id, status: 'processing' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function scrapeFMCSAData(params: ScrapeRequest) {
  const results: any[] = [];
  const { start_point, records, carriers, brokers, authorized, standard } = params;

  let entities = '';
  if (carriers && !brokers) entities = 'CARRIER';
  else if (brokers && !carriers) entities = 'BROKER';
  else if (carriers && brokers) entities = 'CARRIER,BROKER';

  console.log(`Scraping with entities: ${entities}, authorized: ${authorized}, standard: ${standard}`);

  for (let mc = start_point; mc < start_point + records; mc++) {
    try {
      const data = await crawlMCData(mc, entities, authorized, standard);
      if (data) {
        results.push(data);
        console.log(`Scraped MC ${mc}`);
      }
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
    } catch (error) {
      console.error(`Error scraping MC ${mc}:`, error);
    }
  }

  console.log(`Scraping complete. Total results: ${results.length}`);
  return results;
}

async function crawlMCData(
  mc: number,
  entities: string,
  authorized: boolean,
  standard: boolean
) {
  const url = `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=MC_MX&query_string=${mc}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.log(`MC ${mc}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();

    if (!html.includes('Legal Name:')) {
      console.log(`MC ${mc}: Not found in FMCSA`);
      return null;
    }

    const extractValue = (pattern: RegExp): string => {
      const match = html.match(pattern);
      return match ? match[1].replace(/<[^>]*>/g, '').trim() : '';
    };

    const legal_name = extractValue(/Legal Name:\s*<\/th>\s*<td[^>]*>([^<]*(?:<[^>]*>[^<]*)*)/i);
    const dba_name = extractValue(/DBA Name:\s*<\/th>\s*<td[^>]*>([^<]*(?:<[^>]*>[^<]*)*)/i);
    const physical_address = extractValue(/Physical Address:\s*<\/th>\s*<td[^>]*>([^<]*(?:<[^>]*>[^<]*)*)/i);
    const phone = extractValue(/Phone:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const mailing_address = extractValue(/Mailing Address:\s*<\/th>\s*<td[^>]*>([^<]*(?:<[^>]*>[^<]*)*)/i);
    const usdot = extractValue(/USDOT Number:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const state_carrier_id = extractValue(/State Carrier ID Number:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const power_units = extractValue(/Power Units:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const drivers = extractValue(/Drivers:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const mcs_150_date = extractValue(/MCS-150 Form Date:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const out_of_service = extractValue(/Out of Service Date:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const duns = extractValue(/DUNS Number:\s*<\/th>\s*<td[^>]*>([^<]+)/i);

    const entityTypeMatch = html.match(/Entity Type:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const entity_type = entityTypeMatch ? entityTypeMatch[1].trim() : '';

    const operatingStatusMatch = html.match(/Operating Authority Status:\s*<\/th>\s*<td[^>]*>([^<]+)/i);
    const operating_status = operatingStatusMatch ? operatingStatusMatch[1].trim() : '';

    const entityMatch = entities ? entities.split(',').includes(entity_type) : true;
    const statusMatch = standard ? true : (authorized ? operating_status.includes('AUTHORIZED') : !operating_status.includes('AUTHORIZED'));

    if (!entityMatch) {
      console.log(`MC ${mc}: Entity type ${entity_type} not matched (filter: ${entities})`);
      return null;
    }
    
    if (!statusMatch) {
      console.log(`MC ${mc}: Status ${operating_status} not matched (authorized: ${authorized}, standard: ${standard})`);
      return null;
    }
    
    if (!legal_name || !usdot) {
      console.log(`MC ${mc}: Missing required fields (legal_name: ${!!legal_name}, usdot: ${!!usdot})`);
      return null;
    }

    const result = {
      mc: mc.toString(),
      legal_name: legal_name.substring(0, 200),
      dba_name: dba_name.substring(0, 200),
      entity_type,
      operating_status,
      physical_address: physical_address.substring(0, 300),
      phone,
      mailing_address: mailing_address.substring(0, 300),
      usdot,
      state_carrier_id,
      power_units,
      drivers,
      duns,
      mcs_150_date,
      out_of_service,
      scraped_at: new Date().toISOString()
    };

    console.log(`MC ${mc}: Successfully scraped`);
    return result;
  } catch (error) {
    console.error(`Error crawling MC ${mc}:`, error);
    return null;
  }
}
