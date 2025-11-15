import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  email: string;
  subscription_status: 'active' | 'inactive' | 'trial';
  subscription_tier: 'basic' | 'pro' | 'enterprise';
  subscription_end_date: string | null;
  records_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface ScrapeJob {
  id: string;
  user_id: string;
  start_point: number;
  records: number;
  carriers: boolean;
  brokers: boolean;
  authorized: boolean;
  standard: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result_data: any;
  download_url: string | null;
  created_at: string;
  completed_at: string | null;
}
