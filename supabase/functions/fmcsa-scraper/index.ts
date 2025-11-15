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
      .single();

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
      .single();

    if (jobError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scraperPromise = (async () => {
      try {
        const results = await scrapeFMCSAData(requestData);
        
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
      } catch (error) {
        await supabase
          .from('scrape_jobs')
          .update({ status: 'failed' })
          .eq('id', job.id);
      }
    })();

    return new Response(
      JSON.stringify({ job_id: job.id, status: 'processing' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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

  const statusFilter = authorized && !standard
    ? 'AUTHORIZED FOR PropertyFor Licensing and Insurance detailsclick here.'
    : '';

  for (let mc = start_point; mc < start_point + records; mc++) {
    try {
      const data = await crawlMCData(mc, entities, statusFilter, standard);
      if (data) results.push(data);
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    } catch (error) {
      console.error(`Error scraping MC ${mc}:`, error);
    }
  }

  return results;
}

async function crawlMCData(mc: number, entities: string, statusFilter: string, standard: boolean) {
  const url = `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=MC_MX&query_string=${mc}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) return null;

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const centerElement = doc.querySelector('center');
    if (!centerElement) return null;

    const information = centerElement.textContent || '';

    const extractText = (pattern: RegExp) => {
      const match = information.match(pattern);
      return match ? match[1].trim() : '';
    };

    const entityType = doc.querySelector('th:contains("Entity Type:")')?.nextElementSibling?.textContent?.trim() || '';
    const operatingStatus = doc.querySelector('th:contains("Operating Authority Status:")')?.nextElementSibling?.textContent?.trim() || '';

    const entityMatch = entities ? entities.split(',').includes(entityType) : true;
    const statusMatch = standard ? true : (statusFilter ? operatingStatus.includes('AUTHORIZED') : false);

    if (!entityMatch || !statusMatch) return null;

    return {
      mc: mc.toString(),
      entity_type: entityType,
      operating_status: operatingStatus,
      legal_name: extractText(/Legal Name:(.*)DBA/),
      dba_name: extractText(/DBA Name:(.*)Physical Address/),
      physical_address: extractText(/Physical Address:(.*)Phone/),
      phone: extractText(/Phone:(.*)Mailing Address/),
      mailing_address: extractText(/Mailing Address:(.*)USDOT/),
      usdot: extractText(/USDOT Number:(.*)State Carrier ID/),
      power_units: extractText(/Power Units:(.*)Drivers/),
      drivers: extractText(/Drivers:(.*)MCS-150/),
      scraped_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error crawling MC ${mc}:`, error);
    return null;
  }
}
