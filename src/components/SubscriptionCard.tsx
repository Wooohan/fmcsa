import { Check } from 'lucide-react';

interface SubscriptionPlan {
  name: string;
  tier: 'basic' | 'pro' | 'enterprise';
  price: string;
  records: number;
  features: string[];
  popular?: boolean;
}

interface SubscriptionCardProps {
  plan: SubscriptionPlan;
  onSelect: (tier: 'basic' | 'pro' | 'enterprise') => void;
}

export function SubscriptionCard({ plan, onSelect }: SubscriptionCardProps) {
  return (
    <div
      className={`relative rounded-2xl border-2 p-8 transition-all hover:shadow-xl ${
        plan.popular
          ? 'border-blue-500 shadow-lg scale-105'
          : 'border-gray-200 hover:border-blue-300'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
          Most Popular
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
          <span className="text-gray-500">/month</span>
        </div>
        <p className="text-sm text-gray-600 mt-2">{plan.records.toLocaleString()} records/month</p>
      </div>

      <ul className="space-y-4 mb-8">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan.tier)}
        className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
          plan.popular
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
        }`}
      >
        Get Started
      </button>
    </div>
  );
}
