import { useState, useEffect } from 'react';
import { LogOut, Database, Download, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ScrapeJob } from '../lib/supabase';

export function Dashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [startPoint, setStartPoint] = useState('1580000');
  const [records, setRecords] = useState('100');
  const [carriers, setCarriers] = useState(true);
  const [brokers, setBrokers] = useState(false);
  const [authorized, setAuthorized] = useState(true);
  const [standard, setStandard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchJobs = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('scrape_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) setJobs(data);
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fmcsa-scraper`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            start_point: parseInt(startPoint),
            records: parseInt(records),
            carriers,
            brokers,
            authorized,
            standard,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start scraping');
      }

      await fetchJobs();
      await refreshProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = (job: ScrapeJob) => {
    if (!job.result_data) return;

    const csv = convertToCSV(job.result_data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fmcsa_${job.start_point}_${job.start_point + job.records}.csv`;
    a.click();
  };

  const convertToCSV = (data: any[]) => {
    if (!data.length) return '';

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(val =>
        `"${String(val).replace(/"/g, '""')}"`
      ).join(',')
    );

    return [headers, ...rows].join('\n');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSubscriptionColor = () => {
    if (profile?.subscription_status === 'active') return 'bg-green-100 text-green-800';
    if (profile?.subscription_status === 'trial') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-500" />
              <h1 className="text-2xl font-bold text-gray-900">FMCSA Scraper</h1>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Subscription</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSubscriptionColor()}`}>
                {profile?.subscription_status}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 capitalize">{profile?.subscription_tier}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Records Remaining</h3>
            <p className="text-2xl font-bold text-gray-900">
              {profile?.records_remaining?.toLocaleString()}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Expiry Date</h3>
            <p className="text-2xl font-bold text-gray-900">
              {profile?.subscription_end_date
                ? new Date(profile.subscription_end_date).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Start New Scrape</h2>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleScrape} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Point
                </label>
                <input
                  type="number"
                  value={startPoint}
                  onChange={(e) => setStartPoint(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Records
                </label>
                <input
                  type="number"
                  value={records}
                  onChange={(e) => setRecords(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  max={profile?.records_remaining}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Max: {profile?.records_remaining} records
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Entity Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carriers}
                      onChange={(e) => setCarriers(e.target.checked)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">Carriers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={brokers}
                      onChange={(e) => setBrokers(e.target.checked)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">Brokers</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Operating Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={authorized}
                      onChange={(e) => setAuthorized(e.target.checked)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">Authorized</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={standard}
                      onChange={(e) => setStandard(e.target.checked)}
                      className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">Standard</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !profile?.records_remaining}
                className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Starting Scrape...' : 'Start Scraping'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Jobs</h2>

            <div className="space-y-4">
              {jobs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No jobs yet</p>
              ) : (
                jobs.map((job) => (
                  <div
                    key={job.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          MC {job.start_point} - {job.start_point + job.records}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {job.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{job.records} records</span>
                      {job.status === 'completed' && job.result_data && (
                        <button
                          onClick={() => downloadResults(job)}
                          className="flex items-center gap-1 text-blue-500 hover:text-blue-600 font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
