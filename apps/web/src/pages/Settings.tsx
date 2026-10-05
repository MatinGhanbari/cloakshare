import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { getStoredTheme, setTheme, type ThemePreference } from '../lib/theme';
import {
  Chip,
  DetailRow,
  PageHeader,
  Panel,
  PanelHeader,
  SegmentedControl,
} from '../components/ui';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
  { value: 'system', label: 'system' },
];

/** Free-tier ceilings, rendered as a spec grid rather than a bulleted list. */
const FREE_LIMITS = [
  { label: 'Links', value: '50', unit: '/ month' },
  { label: 'Views', value: '500', unit: '/ month' },
  { label: 'Max expiry', value: '7', unit: 'days' },
  { label: 'API requests', value: '10', unit: '/ min' },
];

export default function Settings() {
  const { user } = useAuth();
  const [themePref, setThemePref] = useState<ThemePreference>(getStoredTheme());

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />

      <Panel className="mb-6 p-5">
        <PanelHeader title="Account" />
        <dl className="mt-3 divide-y divide-border-subtle">
          <DetailRow label="Email" value={user?.email} mono />
          <DetailRow
            label="Plan"
            value={<Chip tone="accent">{user?.plan || 'free'}</Chip>}
          />
        </dl>
      </Panel>

      <Panel className="mb-6 p-5">
        <PanelHeader
          title="Appearance"
          description="Theme for this dashboard. System follows your operating system. The link viewer runs on its own origin, so it keeps its own switch."
        />
        <div className="mt-4">
          <SegmentedControl
            label="Theme"
            options={THEME_OPTIONS}
            value={themePref}
            onChange={(next) => {
              setTheme(next);
              setThemePref(next);
            }}
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Plan and billing"
          description={`You are on the ${user?.plan || 'free'} plan.`}
        />
        {user?.plan === 'free' && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {FREE_LIMITS.map((limit) => (
              <div key={limit.label}>
                <dt className="text-xs text-text-tertiary">{limit.label}</dt>
                <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                  {limit.value}
                  <span className="ml-1 font-sans text-xs font-normal text-text-tertiary">
                    {limit.unit}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>
    </div>
  );
}
