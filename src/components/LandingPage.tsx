import { useState } from 'react';
import { Database, Shield, Zap, Download, TrendingUp, Clock } from 'lucide-react';
import { SubscriptionCard } from './SubscriptionCard';
import { AuthModal } from './AuthModal';
import { supabase } from '../lib/supabase';

const plans = [
  {
    name: 'Basic',
    tier: 'basic' as const,
    price: '49',
    records: 1000,
    features: [
      '1,000 records per month',
      'Carrier & Broker data',
      'CSV export',
      'Email support',
      'Basic filters',
    ],
  },
  {
    name: 'Pro',
    tier: 'pro' as const,
    price: '149',
    records: 5000,
    features: [
      '5,000 records per month',
      'Priority processing',
      'Advanced filters',
      'Bulk downloads',
      'Priority email support',
      'API access',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    tier: 'enterprise' as const,
    price: '399',
    records: 20000,
    features: [
      '20,000 records per month',
      'Fastest processing',
      'Custom filters',
      'Dedicated support',
      'Advanced API access',
      'Custom integrations',
    ],
  },
];

export function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedTier, setSelectedTier] = useState<'basic' | 'pro' | 'enterprise' | null>(null);

  const handleSelectPlan = (tier: 'basic' | 'pro' | 'enterprise') => {
    setSelectedTier(tier);
    setAuthMode('signup');
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900">FMCSA Scraper</span>
            </div>
            <button
              onClick={() => {
                setAuthMode('signin');
                setAuthModalOpen(true);
              }}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-white to-gray-50">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Extract FMCSA Data
            <br />
            <span className="text-blue-500">Fast & Professional</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Access comprehensive carrier and broker information from the FMCSA public directory.
            Get verified data with advanced filtering and instant CSV downloads.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setAuthMode('signup');
                setAuthModalOpen(true);
              }}
              className="px-8 py-4 bg-blue-500 text-white rounded-lg font-semibold text-lg hover:bg-blue-600 transition-colors shadow-lg hover:shadow-xl"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => {
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-8 py-4 bg-white text-gray-900 border-2 border-gray-200 rounded-lg font-semibold text-lg hover:border-gray-300 transition-colors"
            >
              View Pricing
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            Why Choose Our Scraper?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6">
                <Zap className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Lightning Fast</h3>
              <p className="text-gray-600 leading-relaxed">
                Extract thousands of records in minutes with our optimized scraping engine.
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6">
                <Shield className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Reliable & Secure</h3>
              <p className="text-gray-600 leading-relaxed">
                Built with enterprise-grade security and data accuracy you can trust.
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-6">
                <Download className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Instant Downloads</h3>
              <p className="text-gray-600 leading-relaxed">
                Export your data to CSV format instantly and integrate with your workflow.
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-2xl mb-6">
                <TrendingUp className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Advanced Filters</h3>
              <p className="text-gray-600 leading-relaxed">
                Filter by carrier type, operating status, and more to get exactly what you need.
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-6">
                <Clock className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Real-Time Updates</h3>
              <p className="text-gray-600 leading-relaxed">
                Monitor your scraping jobs in real-time with live status updates.
              </p>
            </div>

            <div className="text-center p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 rounded-2xl mb-6">
                <Database className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Comprehensive Data</h3>
              <p className="text-gray-600 leading-relaxed">
                Access complete carrier profiles including contact info, equipment, and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your needs. All plans include a 7-day free trial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <SubscriptionCard
                key={plan.tier}
                plan={plan}
                onSelect={handleSelectPlan}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of businesses using our platform to access FMCSA data.
          </p>
          <button
            onClick={() => {
              setAuthMode('signup');
              setAuthModalOpen(true);
            }}
            className="px-8 py-4 bg-white text-blue-500 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            Start Your Free Trial
          </button>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Database className="w-6 h-6 text-blue-400" />
            <span className="text-xl font-bold text-white">FMCSA Scraper</span>
          </div>
          <p className="text-sm">
            Professional data extraction from FMCSA public directory
          </p>
          <p className="text-xs mt-4">
            &copy; {new Date().getFullYear()} FMCSA Scraper. All rights reserved.
          </p>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}
