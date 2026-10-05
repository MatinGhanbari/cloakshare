import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import NotificationBell from './NotificationBell';
import { Button, IconButton, cx } from './ui';
import {
  AuditIcon,
  CloseIcon,
  GroupsIcon,
  KeyIcon,
  LinksIcon,
  MenuIcon,
  SettingsIcon,
  TeamIcon,
  UploadIcon,
} from './icons';

/**
 * Rail width lives in `--rail-width` (index.css) so the aside and the content offset
 * cannot drift apart. The original layout hard-coded 220px in two places.
 */

/**
 * Route labels and paths are intentionally unchanged: they are muscle memory and the
 * analytics/tracking surface. Only the presentation moved.
 */
const navGroups: Array<{ items: Array<{ label: string; path: string; icon: ReactNode }> }> = [
  {
    items: [
      { label: 'Links', path: '/links', icon: <LinksIcon size={16} /> },
      { label: 'Upload', path: '/upload', icon: <UploadIcon size={16} /> },
      { label: 'Groups', path: '/groups', icon: <GroupsIcon size={16} /> },
      { label: 'API Keys', path: '/api-keys', icon: <KeyIcon size={16} /> },
    ],
  },
  {
    items: [
      { label: 'Team', path: '/team', icon: <TeamIcon size={16} /> },
      { label: 'Audit Log', path: '/audit-log', icon: <AuditIcon size={16} /> },
      { label: 'Settings', path: '/settings', icon: <SettingsIcon size={16} /> },
    ],
  },
];

function NavItem({
  label,
  path,
  icon,
  onNavigate,
}: {
  label: string;
  path: string;
  icon: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={path}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          'relative flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium',
          'transition-colors duration-150 ease-expo',
          isActive
            ? 'bg-accent-muted text-foreground'
            : 'text-text-tertiary hover:bg-hover hover:text-text-secondary',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent"
            />
          )}
          <span className={isActive ? 'text-accent' : 'text-current'}>{icon}</span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export default function DashboardLayout() {
  const { user, logout, activeOrg, switchOrg } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock the page behind the mobile drawer so the document does not scroll under it.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  // Close the drawer if the viewport grows past the breakpoint while it is open.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (user?.email || '??').slice(0, 2).toUpperCase();
  const plan = activeOrg?.plan || user?.plan || 'free';

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand. The wordmark itself is unchanged by design. */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border-subtle px-5">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
        <span className="font-mono text-base font-bold tracking-tight text-foreground">
          Scrinium
        </span>
      </div>

      {user?.orgs && user.orgs.length > 1 && (
        <div className="shrink-0 px-3 pt-3">
          <label
            htmlFor="org-switcher"
            className="mb-1.5 block px-1 text-[11px] font-medium text-text-tertiary"
          >
            Organization
          </label>
          <select
            id="org-switcher"
            value={activeOrg?.id || ''}
            onChange={(e) => switchOrg(e.target.value)}
            className="w-full rounded-control border border-border bg-elevated px-2.5 py-1.5 text-xs text-foreground transition-colors duration-150 ease-expo focus:border-accent-line focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {user.orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="my-3 border-t border-border-subtle" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.path}
                  label={item.label}
                  path={item.path}
                  icon={item.icon}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="shrink-0 border-t border-border-subtle p-3">
        <div className="flex items-center gap-3 rounded-control px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-elevated text-xs font-medium text-text-secondary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-foreground">{user?.email}</p>
            <p className="mt-0.5 text-[11px] capitalize text-text-tertiary">{plan}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1 px-1">
          <NotificationBell />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            className="ml-auto"
          >
            Log out
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border-subtle bg-surface/95 px-4 backdrop-blur md:hidden">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-mono text-base font-bold tracking-tight text-foreground">
            Scrinium
          </span>
        </span>
        <IconButton
          label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
        </IconButton>
      </div>

      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Rail */}
      <aside
        style={{ width: 'var(--rail-width)' }}
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border-subtle bg-surface',
          'transition-transform duration-200 ease-expo',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {sidebar}
      </aside>

      {/* Content */}
      <main className="min-h-screen pt-14 md:pl-[var(--rail-width)] md:pt-0">
        <div className="mx-auto w-full max-w-content px-5 py-6 md:px-8 md:py-8">
          {/* Keyed by route so the entry transition replays on navigation. */}
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
