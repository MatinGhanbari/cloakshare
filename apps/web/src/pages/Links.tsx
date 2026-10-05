import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { linksApi } from '../lib/api';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
  buttonStyles,
} from '../components/ui';
import { ChevronLeftIcon, ChevronRightIcon, FileIcon, LockIcon, UploadIcon } from '../components/icons';

interface LinkItem {
  id: string;
  secure_url: string;
  name: string | null;
  original_filename: string | null;
  access_group_id: string | null;
  disabled: boolean;
  disabled_at: string | null;
  file_type: string;
  page_count: number;
  status: string;
  view_count: number;
  created_at: string;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function Links() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Temporarily pause or resume a link without revoking it. */
  const toggleDisabled = async (link: LinkItem) => {
    setBusyId(link.id);
    setError('');
    try {
      const next = !link.disabled;
      await linksApi.setState(link.id, next);
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, disabled: next } : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the link state');
    } finally {
      setBusyId(null);
    }
  };

  const load = (target: number) => {
    setLoading(true);
    setError('');
    linksApi.list({ page: target, limit: 20 })
      .then((data) => {
        setLinks(data.links);
        setTotalPages(data.pagination.pages);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load links');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(page);
    // `load` is stable enough for this effect: it only depends on the page argument.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const countLabel =
    totalPages > 1
      ? `${links.length} on this page`
      : `${links.length} ${links.length === 1 ? 'link' : 'links'}`;

  return (
    <div>
      <PageHeader
        title="Links"
        meta={
          !loading && !error ? <span className="text-xs text-text-tertiary">{countLabel}</span> : null
        }
        actions={
          <Link to="/upload" className={buttonStyles('primary', 'sm')}>
            <UploadIcon size={14} />
            Upload
          </Link>
        }
      />

      {loading ? (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <div className="border-b border-border-subtle px-4 py-2.5">
            <Skeleton className="h-3 w-24" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border-subtle px-4 py-3.5 last:border-0">
              <Skeleton className="h-3.5 w-52" />
              <Skeleton className="ml-auto h-3 w-16" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(page)} />
      ) : links.length === 0 ? (
        <EmptyState
          icon={<FileIcon size={18} />}
          title="No links yet"
          description="Upload a document to render it server-side and hand out a watermarked, access-controlled link."
          action={
            <Link to="/upload" className={buttonStyles('primary', 'sm')}>
              <UploadIcon size={14} />
              Upload a document
            </Link>
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th align="right">Views</Th>
                <Th className="md:hidden lg:table-cell">Type</Th>
                <Th align="right">Created</Th>
                <Th align="right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <Tr key={link.id}>
                  <Td label="Name">
                    <Link
                      to={`${link.id}`}
                      className="text-sm font-medium text-foreground transition-colors duration-150 ease-expo hover:text-accent"
                    >
                      {link.original_filename || link.name || (
                        <span className="font-mono text-text-secondary">{link.id}</span>
                      )}
                    </Link>
                    {link.name && link.original_filename && (
                      <span className="mt-0.5 block text-xs text-text-tertiary">{link.name}</span>
                    )}
                    {link.access_group_id && (
                      <Chip tone="accent" className="mt-1.5">
                        <LockIcon size={11} />
                        Restricted
                      </Chip>
                    )}
                  </Td>
                  <Td label="Status">
                    <StatusBadge status={link.status} />
                    {link.disabled && (
                      <Chip tone="warning" className="mt-1.5">
                        Disabled
                      </Chip>
                    )}
                  </Td>
                  <Td align="right" label="Views">
                    <span className="font-mono text-sm tabular-nums text-text-secondary">
                      {link.view_count}
                    </span>
                  </Td>
                  <Td label="Type" className="md:hidden lg:table-cell">
                    <span
                      className={`font-mono text-xs uppercase ${
                        link.file_type === 'video' ? 'text-accent' : 'text-text-tertiary'
                      }`}
                    >
                      {link.file_type}
                    </span>
                  </Td>
                  <Td align="right" label="Created">
                    <span className="whitespace-nowrap text-xs text-text-tertiary">
                      {timeAgo(link.created_at)}
                    </span>
                  </Td>
                  <Td align="right">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void toggleDisabled(link)}
                      loading={busyId === link.id}
                    >
                      {link.disabled ? 'Enable' : 'Disable'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-6 flex items-center justify-center gap-3"
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeftIcon size={14} />
                Prev
              </Button>
              <span className="font-mono text-xs tabular-nums text-text-tertiary">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRightIcon size={14} />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
