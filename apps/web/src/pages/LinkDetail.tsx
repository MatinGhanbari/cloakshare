import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { linksApi, groupsApi, ApiError } from '../lib/api';
import {
  Banner,
  Button,
  Chip,
  CopyField,
  DetailRow,
  PageHeader,
  Panel,
  PanelHeader,
  Select,
  Skeleton,
  StatTile,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { ArrowLeftIcon, ClockIcon, EyeIcon, LockIcon } from '../components/icons';
import { glyph, useActionStatus } from '../components/morph';

export default function LinkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<Awaited<ReturnType<typeof linksApi.get>> | null>(null);
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof linksApi.analytics>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // One action status per irreversible / stateful control, so each button morphs on its own.
  const revokeAction = useActionStatus();
  const purgeAction = useActionStatus();
  const stateAction = useActionStatus();
  const accessAction = useActionStatus();

  // Access control
  const [groups, setGroups] = useState<Array<{ id: string; name: string; member_count: number }>>([]);
  const [accessGroupId, setAccessGroupId] = useState('');
  
  const splitDuration = (totalSeconds = 0) => {
    const secs = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;

    if (h > 0) return { primary: `${h}h`, secondary: m > 0 ? `${m}m` : null };
    if (m > 0) return { primary: `${m}m`, secondary: s > 0 ? `${s}s` : null };
    return { primary: `${s}s`, secondary: null };
  };

  const { primary, secondary } = splitDuration(analytics?.avg_duration);

  useEffect(() => {
    groupsApi
      .list()
      .then((d) => setGroups(d.groups))
      .catch(() => {
        /* the picker simply stays empty */
      });
  }, []);

  useEffect(() => {
    if (link) setAccessGroupId(link.access_group_id ?? '');
  }, [link]);

  const saveAccess = async () => {
    if (!link) return;
    await accessAction.run(async () => {
      try {
        await linksApi.updateAccess(link.id, accessGroupId || null);
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not update access');
        return false;
      }
    });
  };

  /** Temporarily pause or resume the link without revoking it. */
  const toggleDisabled = async () => {
    if (!link) return;
    await stateAction.run(async () => {
      try {
        const next = !link.disabled;
        await linksApi.setState(link.id, next);
        setLink({
          ...link,
          disabled: next,
          disabled_at: next ? new Date().toISOString() : null,
        });
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not change the link state');
        return false;
      }
    });
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([linksApi.get(id), linksApi.analytics(id).catch(() => null)])
      .then(([linkData, analyticsData]) => {
        setLink(linkData);
        setAnalytics(analyticsData);
      })
      .catch(() => navigate('/links'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleRevoke = async () => {
    if (!id || !confirm('Revoke this link? Viewers will lose access immediately.')) return;
    setError('');
    await revokeAction.run(async () => {
      try {
        await linksApi.revoke(id);
        setLink((prev) => (prev ? { ...prev, status: 'revoked' } : null));
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to revoke link');
        return false;
      }
    });
  };

  /** Delete the link and everything it owns. Irreversible, so it asks by name first. */
  const handlePurge = async () => {
    if (!id || !link) return;
    const confirmed = confirm(
      `Delete "${link.name || link.id}" permanently?\n\n` +
        'The document, its rendered pages, every viewer session and all view history are ' +
        'destroyed, and any webhook subscribers are notified. This cannot be undone.',
    );
    if (!confirmed) return;

    setError('');
    await purgeAction.run(async () => {
      try {
        await linksApi.purge(id);
        // The link no longer exists, so this page has nothing left to show.
        navigate('/links');
        return true;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete link');
        return false;
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Panel key={i} className="p-5">
              <Skeleton className="mb-3 h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </Panel>
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!link) return null;

  const isVideo = link.file_type === 'video';

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <button
            onClick={() => navigate('/links')}
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-text-tertiary transition-colors duration-150 ease-expo hover:text-text-secondary"
          >
            <ArrowLeftIcon size={13} />
            Back to links
          </button>
        }
        title={link.name || <span className="font-mono">{link.id}</span>}
        meta={
          <>
            <StatusBadge status={link.status} />
            <span
              className={`font-mono text-xs uppercase ${isVideo ? 'text-accent' : 'text-text-tertiary'}`}
            >
              {link.file_type}
            </span>
            {isVideo && link.video_metadata ? (
              <>
                <span className="font-mono text-xs text-text-tertiary">
                  {Math.floor(link.video_metadata.duration / 60)}:
                  {String(link.video_metadata.duration % 60).padStart(2, '0')}
                </span>
                <span className="font-mono text-xs text-text-tertiary">
                  {link.video_metadata.qualities.join(', ')}
                </span>
              </>
            ) : link.page_count ? (
              <span className="text-xs text-text-tertiary">{link.page_count} pages</span>
            ) : null}
          </>
        }
        actions={
          <>
            {link.status === 'active' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleRevoke()}
                status={revokeAction.status}
                icon={glyph.block}
                busyLabel="Revoking"
                doneLabel="Revoked"
              >
                Revoke
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-control border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Stats. Data breathes in the open, without a container per number. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Total views"
          value={link.view_count}
          icon={<EyeIcon size={14} />}
        />
        <StatTile
          label="Unique viewers"
          value={analytics?.unique_viewers ?? 0}
          icon={<LockIcon size={14} />}
        />
        <StatTile
          label={isVideo ? 'Avg watch time' : 'Avg duration'}
          icon={<ClockIcon size={14} />}
          value={
            <span className="inline-flex items-baseline gap-1 tabular-nums">
              <span className="text-2xl font-semibold text-foreground">{primary}</span>
              {secondary && (
                <span className="text-sm font-medium text-muted-foreground">{secondary}</span>
              )}
            </span>
          }
        />
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Secure link"
          description="Anyone with this URL and the required credentials can open the document."
        />
        <CopyField value={link.secure_url} className="mt-4" />
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Link state"
          description="Disabling pauses the link temporarily: viewers see an unavailable message. Expiry and settings are kept, so re-enabling restores exactly what it was. To remove the link and its data for good, delete it instead."
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant={link.disabled ? 'primary' : 'secondary'}
            onClick={() => void toggleDisabled()}
            status={stateAction.status}
            icon={link.disabled ? glyph.enable : glyph.disable}
            busyLabel="Saving"
            doneLabel="Saved"
            disabled={link.status === 'revoked'}
          >
            {link.disabled ? 'Enable link' : 'Disable link'}
          </Button>
          <span className="text-xs text-text-tertiary">
            {link.status === 'revoked'
              ? 'Revoked links cannot be re-enabled.'
              : link.disabled
                ? 'Currently disabled. Viewers cannot open it.'
                : 'Currently enabled.'}
          </span>
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader title="Rules" />
        <dl className="mt-3 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          <DetailRow
            label="Expires"
            value={
              link.rules.expires_at
                ? new Date(link.rules.expires_at).toLocaleDateString()
                : 'Never'
            }
          />
          <DetailRow label="Max views" value={link.rules.max_views ?? 'Unlimited'} mono />
          <DetailRow label="Email required" value={link.rules.require_email ? 'Yes' : 'No'} />
          <DetailRow label="Password" value={link.rules.has_password ? 'Yes' : 'No'} />
          <DetailRow label="Watermark" value={link.rules.watermark ? 'Yes' : 'No'} />
          <DetailRow label="Download blocked" value={link.rules.block_download ? 'Yes' : 'No'} />
        </dl>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Access"
          description="Public links are gated by email. Restricted links require the viewer to sign in with a student ID and national ID belonging to the selected group."
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            aria-label="Access group"
            value={accessGroupId}
            onChange={(e) => setAccessGroupId(e.target.value)}
            className="flex-1"
          >
            <option value="">Public - anyone with the link</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.member_count} member{g.member_count === 1 ? '' : 's'})
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="primary"
            onClick={() => void saveAccess()}
            status={accessAction.status}
            icon={glyph.save}
            busyLabel="Saving"
            doneLabel="Saved"
            disabled={accessGroupId === (link.access_group_id ?? '')}
          >
            Save
          </Button>
        </div>
        {groups.length === 0 && (
          <p className="mt-3 text-xs text-text-tertiary">
            No groups yet. Create one under Groups to restrict this link.
          </p>
        )}
      </Panel>

      {link.recent_views.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-foreground">Recent views</h2>
          <Table>
            <thead>
              <tr>
                <Th>Viewer</Th>
                <Th align="right">{isVideo ? 'Watch time' : 'Duration'}</Th>
                <Th>{isVideo ? 'Progress' : 'Pages'}</Th>
                <Th className="md:hidden lg:table-cell">Device</Th>
                <Th align="right">When</Th>
              </tr>
            </thead>
            <tbody>
              {link.recent_views.map((view, i) => (
                <Tr key={i}>
                  <Td label="Viewer">
                    <span className="text-sm text-text-secondary">
                      {view.viewer_email || <span className="text-text-tertiary italic">anonymous</span>}
                    </span>
                  </Td>
                  <Td align="right" label={isVideo ? 'Watch time' : 'Duration'}>
                    <span className="font-mono text-sm tabular-nums text-text-secondary">
                      {isVideo ? `${view.video_watch_time ?? view.duration}s` : `${view.duration}s`}
                    </span>
                  </Td>
                  <Td label={isVideo ? 'Progress' : 'Pages'}>
                    {isVideo ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-expo"
                            style={{ width: `${Math.round((view.completion_rate ?? 0) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs tabular-nums text-text-tertiary">
                          {Math.round((view.completion_rate ?? 0) * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-sm tabular-nums text-text-secondary">
                        {view.pages_viewed}
                      </span>
                    )}
                  </Td>
                  <Td label="Device" className="md:hidden lg:table-cell">
                    <Chip>{view.device}</Chip>
                  </Td>
                  <Td align="right" label="When">
                    <span className="whitespace-nowrap text-xs text-text-tertiary">
                      {new Date(view.viewed_at).toLocaleDateString()}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {/*
        Last on the page and deliberately separated from the reversible actions above: this is the
        only control here that destroys data.
      */}
      <Panel className="p-5">
        <PanelHeader
          title="Delete this link"
          description="Removes the link, the document and its rendered pages, every viewer session and all view history. The audit log entry is kept."
        />
        <Banner tone="danger" className="mt-3">
          Deleting cannot be undone, and any webhook subscribers are notified with a
          <span className="font-mono"> link.deleted </span>
          event. To end access while keeping the link and its analytics, revoke it instead.
        </Banner>
        <div className="mt-4">
          <Button
            variant="danger"
            onClick={() => void handlePurge()}
            status={purgeAction.status}
            icon={glyph.trash}
            busyLabel="Deleting"
          >
            Delete permanently
          </Button>
        </div>
      </Panel>
    </div>
  );
}
