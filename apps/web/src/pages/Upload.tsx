import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { linksApi, ApiError } from '../lib/api';
import {
  Button,
  CopyField,
  Field,
  InlineError,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  StatusBadge,
} from '../components/ui';
import { ExternalLinkIcon, FileIcon, ShieldIcon, UploadIcon } from '../components/icons';
import { glyph, useActionStatus } from '../components/morph';

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv';

interface CreatedLink {
  id: string;
  secure_url: string;
  status: string;
  file_type: string;
}

/** Grounded in the renderer's actual behaviour, not marketing copy. */
const PROTECTIONS = [
  {
    title: 'Watermarked per viewer',
    body: 'The viewer identity is burned into every page before the image is sliced, so a copy can be traced back to a session.',
  },
  {
    title: 'Access gated',
    body: 'Email, password, or a student group can gate the link. Revoking it cuts access immediately.',
  },
  {
    title: 'Rate limited',
    body: 'Page, tile and viewport requests are budgeted per session, which bounds how fast a document can be walked.',
  },
];

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [dragging, setDragging] = useState(false);

  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedLink | null>(null);

  // The button owns the busy/done lifecycle; `progress` still drives the bar.
  const { status, run } = useActionStatus();
  const uploading = status === 'busy';

  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setError('');
    setCreated(null);
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a file to upload');
      return;
    }

    setProgress(0);
    setError('');
    setCreated(null);

    await run(async () => {
      try {
        const result = await linksApi.create(file, {
          name: name.trim() || undefined,
          expiresIn: expiresIn || undefined,
          maxViews: maxViews ? Number(maxViews) : undefined,
          onProgress: setProgress,
        });
        setCreated(result);
        setFile(null);
        setName('');
        if (inputRef.current) inputRef.current.value = '';
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Upload failed');
        return false;
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="Upload a document"
        description="The file is rendered server-side and served through the secure tile viewer. Every page carries the viewer's identity in a burned-in watermark."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <Panel className="p-5">
            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files?.[0] ?? null);
              }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Choose a file to upload"
              className={`flex cursor-pointer flex-col items-center justify-center rounded-control border border-dashed px-6 py-10 text-center transition-colors duration-150 ease-expo focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                dragging
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-border-strong hover:bg-hover/40'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
              <span
                className={`mb-3 flex h-11 w-11 items-center justify-center rounded-control border ${
                  dragging ? 'border-accent-line bg-accent-muted text-accent' : 'border-border bg-elevated text-text-tertiary'
                }`}
              >
                {file ? <FileIcon size={18} /> : <UploadIcon size={18} />}
              </span>
              <p className="text-sm font-medium text-foreground">
                {file ? file.name : 'Drop a file here, or click to choose'}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                  : 'PDF, images, Office documents and CSV'}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                label="Display name"
                htmlFor="display-name"
                hint="Shown in your links list."
                className="sm:col-span-3"
              >
                <Input
                  id="display-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional label"
                />
              </Field>
              <Field label="Expires in" htmlFor="expires-in" hint="For example 7d.">
                <Input
                  id="expires-in"
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  placeholder="7d"
                />
              </Field>
              <Field
                label="Max views"
                htmlFor="max-views"
                hint="Empty means unlimited."
                className="sm:col-span-2"
              >
                <Input
                  id="max-views"
                  inputMode="numeric"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value.replace(/\D/g, ''))}
                  placeholder="Unlimited"
                />
              </Field>
            </div>

            {uploading && (
              <div className="mt-5">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200 ease-expo"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 font-mono text-xs tabular-nums text-text-tertiary">
                  Uploading {progress}%
                </p>
              </div>
            )}

            {error && (
              <div className="mt-5">
                <InlineError>{error}</InlineError>
              </div>
            )}

            <div className="mt-5">
              <Button
                type="submit"
                variant="primary"
                status={status}
                icon={glyph.upload}
                busyLabel="Uploading"
                doneLabel="Link created"
                disabled={!file}
                className="w-full"
              >
                Upload and create link
              </Button>
            </div>
          </Panel>

          {created && (
            <Panel className="p-5">
              <PanelHeader
                title="Link created"
                description={
                  created.status === 'processing'
                    ? 'Pages are still being rendered. The link works as soon as rendering finishes.'
                    : 'The link is ready to share.'
                }
                actions={<StatusBadge status={created.status} />}
              />
              <CopyField value={created.secure_url} className="mt-4" />
              <Link
                to={`/links/${created.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent transition-colors duration-150 ease-expo hover:text-accent-hover"
              >
                Open link details
                <ExternalLinkIcon size={14} />
              </Link>
            </Panel>
          )}
        </form>

        {/* Reference column. Facts only, no filler. */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Panel className="p-5">
            <PanelHeader
              title={
                <span className="flex items-center gap-2">
                  <ShieldIcon size={14} />
                  What protects this file
                </span>
              }
            />
            <ul className="mt-4 space-y-4">
              {PROTECTIONS.map((item) => (
                <li key={item.title}>
                  <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-tertiary">{item.body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-border-subtle pt-4 text-xs leading-relaxed text-text-tertiary">
              Tile transport is encrypted, but the watermark and the rate limits are what actually
              deter a leak. Treat any shared document as copyable by the person viewing it.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
