import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { billingApi } from '../lib/api';
import {
  Button,
  Chip,
  InlineError,
  PageHeader,
  Panel,
  PanelHeader,
  SegmentedControl,
  cx,
} from '../components/ui';
import { CheckIcon } from '../components/icons';
import { glyph } from '../components/morph';

const plans = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '50 links/month',
      '500 views/month',
      '7-day max expiry',
      '10 API req/min',
      'Community support',
    ],
  },
  {
    id: 'starter' as const,
    name: 'Starter',
    price: '$29',
    period: '/month',
    features: [
      '500 links/month',
      '5,000 views/month',
      '90-day max expiry',
      '60 API req/min',
      'Webhooks',
      'Email support',
    ],
  },
  {
    id: 'growth' as const,
    name: 'Growth',
    price: '$99',
    period: '/month',
    features: [
      '2,500 links/month',
      '25,000 views/month',
      '1-year max expiry',
      '300 API req/min',
      'Custom domains',
      'Custom branding',
      'Priority support',
    ],
  },
  {
    id: 'scale' as const,
    name: 'Scale',
    price: '$299',
    period: '/month',
    features: [
      '10,000 links/month',
      '100,000 views/month',
      'No expiry limits',
      '1,000 API req/min',
      'Everything in Growth',
      'Embedded viewer',
      'SSO/SAML',
      'Dedicated support',
    ],
  },
];

const annualPrices: Record<string, string> = {
  starter: '$24',
  growth: '$83',
  scale: '$249',
};

export default function Billing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [annual, setAnnual] = useState(false);

  const handleUpgrade = async (planId: 'starter' | 'growth' | 'scale') => {
    setLoading(planId);
    setError('');
    try {
      const { checkout_url } = await billingApi.checkout(planId, annual);
      window.location.href = checkout_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    }
    setLoading(null);
  };

  const handleManage = async () => {
    setLoading('manage');
    setError('');
    try {
      const { portal_url } = await billingApi.portal();
      window.location.href = portal_url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
    setLoading(null);
  };

  const currentPlan = user?.plan || 'free';

  return (
    <div>
      <PageHeader
        title="Plan and billing"
        description={`You are on the ${currentPlan} plan.`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Billing period"
          options={[
            { value: 'monthly', label: 'monthly' },
            { value: 'annual', label: 'annual' },
          ]}
          value={annual ? 'annual' : 'monthly'}
          onChange={(next) => setAnnual(next === 'annual')}
        />
        <span className="text-xs text-text-tertiary">Annual billing saves about 17%.</span>
      </div>

      {error && (
        <div className="mb-6 max-w-3xl">
          <InlineError>{error}</InlineError>
        </div>
      )}

      {currentPlan !== 'free' && (
        <Panel className="mb-6 p-5">
          <PanelHeader
            title="Manage subscription"
            description="Update the payment method, change plan, or cancel."
            actions={
              <Button
                variant="secondary"
                size="sm"
                icon={glyph.external}
                status={loading === 'manage' ? 'busy' : 'idle'}
                busyLabel="Opening"
                onClick={() => void handleManage()}
              >
                Billing portal
              </Button>
            }
          />
        </Panel>
      )}

      {/* One cell per plan. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade = !isCurrent && plan.id !== 'free';

          return (
            <Panel
              key={plan.id}
              className={cx(
                'flex flex-col p-5',
                isCurrent ? 'border-accent-line' : 'card-glow',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">{plan.name}</h3>
                {isCurrent && <Chip tone="accent">Current</Chip>}
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {annual && plan.id !== 'free' ? annualPrices[plan.id] || plan.price : plan.price}
                </span>
                <span className="text-xs text-text-tertiary">
                  {plan.id === 'free' ? plan.period : annual ? '/mo, billed yearly' : plan.period}
                </span>
              </div>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-text-secondary">
                    <span className="mt-0.5 shrink-0 text-accent">
                      <CheckIcon size={13} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {isUpgrade && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    icon={glyph.upgrade}
                    status={loading === plan.id ? 'busy' : 'idle'}
                    busyLabel="Redirecting"
                    onClick={() => void handleUpgrade(plan.id as 'starter' | 'growth' | 'scale')}
                  >
                    Upgrade
                  </Button>
                )}
                {isCurrent && plan.id !== 'free' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    icon={glyph.external}
                    status={loading === 'manage' ? 'busy' : 'idle'}
                    busyLabel="Opening"
                    onClick={() => void handleManage()}
                  >
                    Manage
                  </Button>
                )}
                {isCurrent && plan.id === 'free' && (
                  <p className="text-center text-xs text-text-tertiary">Your current plan</p>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
