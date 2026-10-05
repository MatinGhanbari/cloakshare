import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { linksApi, ApiError } from '../lib/api';

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv';

interface CreatedLink {
  id: string;
  secure_url: string;
  status: string;
  file_type: string;
}

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [dragging, setDragging] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [copied, setCopied] = useState(false);

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

    setUploading(true);
    setProgress(0);
    setError('');
    setCreated(null);

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.secure_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-sans font-semibold text-foreground">Upload a document</h1>
        <p className="text-sm text-text-secondary font-sans mt-1">
          The file is rendered server-side and served through the secure tile viewer. Every page
          carries the viewer's identity in a burned-in watermark, so a leak can be traced.
        </p>
      </div>

      <form onSubmit={submit} className="bg-surface border border-border rounded-lg p-6 card-glow">
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
          className={`border border-dashed rounded-md px-6 py-10 text-center cursor-pointer transition-colors ${
            dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-text-tertiary'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <p className="text-sm font-sans text-foreground">
            {file ? file.name : 'Drop a file here, or click to choose'}
          </p>
          <p className="text-xs text-text-tertiary font-sans mt-1">
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
              : 'PDF, images, Office documents and CSV'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          <div className="sm:col-span-3">
            <label className="block text-[13px] text-text-secondary mb-2 font-sans font-medium">
              Display name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional label shown in your links list"
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="block text-[13px] text-text-secondary mb-2 font-sans font-medium">
              Expires in
            </label>
            <input
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              placeholder="e.g. 7d"
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[13px] text-text-secondary mb-2 font-sans font-medium">
              Max views
            </label>
            <input
              value={maxViews}
              onChange={(e) => setMaxViews(e.target.value.replace(/\D/g, ''))}
              placeholder="Leave empty for unlimited"
              className="w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-sans outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors placeholder:text-text-tertiary"
            />
          </div>
        </div>

        {uploading && (
          <div className="mt-5">
            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary font-sans mt-2">
              Uploading… {progress}%
            </p>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mt-5">
            <p className="text-sm text-destructive font-sans">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className="mt-5 w-full bg-accent text-background font-sans font-medium text-sm py-2.5 rounded-md hover:bg-accent-hover hover:-translate-y-px hover:shadow-glow active:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
        >
          {uploading ? 'Uploading…' : 'Upload and create link'}
        </button>
      </form>

      {created && (
        <div className="bg-surface border border-border rounded-lg p-6 mt-5">
          <p className="text-sm font-sans font-medium text-foreground">Link created</p>
          <p className="text-xs text-text-tertiary font-sans mt-1">
            Status: {created.status}
            {created.status === 'processing' ? ' — pages are being rendered' : ''}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <input
              readOnly
              value={created.secure_url}
              className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-xs font-mono text-text-secondary outline-none"
            />
            <button
              type="button"
              onClick={copy}
              className="text-xs font-sans px-3 py-2 rounded-md border border-border hover:bg-hover transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <Link
            to={`/dashboard/links/${created.id}`}
            className="inline-block mt-3 text-sm text-accent font-sans hover:underline"
          >
            Open link details →
          </Link>
        </div>
      )}
    </div>
  );
}
