/*
  # FMCSA Scraper Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text)
      - `subscription_status` (text) - active, inactive, trial
      - `subscription_tier` (text) - basic, pro, enterprise
      - `subscription_end_date` (timestamptz)
      - `records_remaining` (integer) - monthly quota
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `scrape_jobs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `start_point` (integer)
      - `records` (integer)
      - `carriers` (boolean)
      - `brokers` (boolean)
      - `authorized` (boolean)
      - `standard` (boolean)
      - `status` (text) - pending, processing, completed, failed
      - `result_data` (jsonb)
      - `download_url` (text)
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  subscription_status text DEFAULT 'inactive',
  subscription_tier text DEFAULT 'basic',
  subscription_end_date timestamptz,
  records_remaining integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_point integer NOT NULL,
  records integer NOT NULL,
  carriers boolean DEFAULT true,
  brokers boolean DEFAULT false,
  authorized boolean DEFAULT true,
  standard boolean DEFAULT false,
  status text DEFAULT 'pending',
  result_data jsonb,
  download_url text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scrape jobs"
  ON scrape_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scrape jobs"
  ON scrape_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scrape jobs"
  ON scrape_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_user_id ON scrape_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
