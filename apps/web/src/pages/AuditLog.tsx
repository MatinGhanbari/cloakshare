import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  Button,
  Chip,
  EmptyState,
  InlineError,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
  buttonStyles,
} from '../components/ui';
import { AuditIcon, ChevronRightIcon } from '../components/icons';

interface AuditEntry {
  id: string;
  actor: { id: string; type: string; label: string };
  action: string;
  resource: { type: string; id: string; label: string } | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLog() {
  const { activeOrg } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  async function loadEntries(loadCursor?: string) {
    try {
      setLoading(true);
      const data = await auditApi.list({
        cursor: loadCursor,
        limit: 50,
        action: actionFilter || undefined,
      });
      if (loadCursor) {
        setEntries((prev) => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }
      setCursor(data.pagination.next_cursor);
      setHasMore(data.pagination.has_more);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }

  function formatAction(action: string): string {
    return action.replaceAll('.', ' ').replaceAll('_', ' ');
  }

  const plan = activeOrg?.plan || 'free';

  if (plan === 'free' || plan === 'starter') {
    return (
      <div>
        <PageHeader title="Audit log" />
        <EmptyState
          icon={<AuditIcon size={18} />}
          title="Audit log requires a Growth or Scale plan"
          description="Every link, key and membership change is recorded with its actor, resource and IP address."
          action={
            <Link to="/billing" className={buttonStyles('primary', 'sm')}>
              View plans
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Activity history for your organization."
      />

      {error && (
        <div className="mb-6 max-w-3xl">
          <InlineError>{error}</InlineError>
        </div>
      )}

      <div className="mb-4">
        <Select
          aria-label="Filter by action"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setCursor(null);
          }}
          className="w-full sm:w-64"
        >
          <option value="">All actions</option>
          <option value="link.created">Link created</option>
          <option value="link.revoked">Link revoked</option>
          <option value="api_key.created">API key created</option>
          <option value="api_key.revoked">API key revoked</option>
          <option value="member.invited">Member invited</option>
          <option value="member.joined">Member joined</option>
          <option value="member.role_changed">Role changed</option>
          <option value="member.removed">Member removed</option>
          <option value="org.ownership_transferred">Ownership transferred</option>
        </Select>
      </div>

      {entries.length === 0 && !loading ? (
        <EmptyState
          icon={<AuditIcon size={18} />}
          title="No audit log entries"
          description={
            actionFilter
              ? 'No entries match this filter. Try selecting all actions.'
              : 'Activity will appear here as soon as someone changes something.'
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th className="md:hidden lg:table-cell">Resource</Th>
              <Th className="md:hidden lg:table-cell">IP</Th>
              <Th align="right">
                <span className="sr-only">Details</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const expanded = expandedId === entry.id;
              return (
                <Fragment key={entry.id}>
                  <Tr
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    <Td label="Time">
                      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-text-tertiary">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </Td>
                    <Td label="Actor">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-sm text-foreground">{entry.actor.label}</span>
                        {entry.actor.type === 'api_key' && <Chip>key</Chip>}
                      </span>
                    </Td>
                    <Td label="Action">
                      <span className="text-sm capitalize text-foreground">
                        {formatAction(entry.action)}
                      </span>
                    </Td>
                    <Td label="Resource" className="md:hidden lg:table-cell">
                      <span className="font-mono text-xs text-text-tertiary">
                        {entry.resource ? entry.resource.label || entry.resource.id : 'None'}
                      </span>
                    </Td>
                    <Td label="IP" className="md:hidden lg:table-cell">
                      <span className="font-mono text-xs tabular-nums text-text-tertiary">
                        {entry.ip_address || 'Unknown'}
                      </span>
                    </Td>
                    <Td align="right">
                      {entry.metadata ? (
                        <span
                          className={`inline-flex text-text-tertiary transition-transform duration-150 ease-expo ${
                            expanded ? 'rotate-90' : ''
                          }`}
                        >
                          <ChevronRightIcon size={14} />
                        </span>
                      ) : null}
                    </Td>
                  </Tr>
                  {expanded && entry.metadata && (
                    <tr>
                      <td
                        colSpan={6}
                        data-span=""
                        className="border-b border-border-subtle bg-background px-4 py-3"
                      >
                        <pre className="overflow-x-auto font-mono text-xs text-text-secondary">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}

      {loading && (
        <div className="mt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-3 w-28" />
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-4 text-center">
          <Button variant="secondary" size="sm" onClick={() => cursor && loadEntries(cursor)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
