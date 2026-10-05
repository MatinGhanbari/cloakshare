import { useState } from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { CheckIcon, CopyIcon, Spinner } from './icons';

/** Tiny class joiner. Avoids pulling in a dependency for three lines of logic. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* --- Button -------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Accent pairs with --accent-foreground: #09090b on #00FF88 (dark) and #fff on #00803F (light).
  // Both clear WCAG AA as button text.
  primary: 'bg-accent text-accent-foreground hover:bg-accent-hover shadow-raised',
  secondary:
    'border border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-hover hover:text-foreground',
  ghost: 'text-text-tertiary hover:bg-hover hover:text-foreground',
  danger: 'border border-destructive/30 text-destructive hover:bg-destructive/10',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  // 36px / 40px keeps touch targets usable on a phone without making the table rows tall.
  sm: 'h-9 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * Shared button surface. Exported so an anchor (react-router <Link>) can be styled as a
 * button without nesting an <a> inside a <button>, which is invalid HTML.
 */
export function buttonStyles(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cx(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-expo',
    'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0',
    BUTTON_SIZES[size],
    BUTTON_VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={buttonStyles(variant, size, className)}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-tertiary',
        'transition-colors duration-150 ease-expo hover:bg-hover hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* --- Surfaces ------------------------------------------------------------ */

export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-panel border border-border bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        // Stacks on a phone so a long title never squeezes the action button.
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 max-w-[65ch] text-xs leading-relaxed text-text-tertiary">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Page title block. `meta` renders inline next to the title (counts, status chips);
 * `description` stacks underneath and is capped at a readable measure.
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {back}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {meta}
        </div>
        {description && (
          <p className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/* --- Forms --------------------------------------------------------------- */

/** Shared control surface so inputs and selects cannot drift apart. */
const CONTROL_CLASS = [
  'w-full rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground',
  'placeholder:text-placeholder transition-colors duration-150 ease-expo',
  'focus:border-accent-line focus:outline-none focus:ring-2 focus:ring-accent/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL_CLASS, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(CONTROL_CLASS, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(CONTROL_CLASS, 'resize-y leading-relaxed', className)} {...rest} />;
}

/**
 * Segmented choice. Used where the previous markup stacked a bordered <div> around raw
 * buttons with no pressed state for assistive tech.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx('inline-flex rounded-control border border-border bg-elevated p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-chip px-3 py-1.5 text-xs font-medium capitalize',
              'transition-colors duration-150 ease-expo',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-text-secondary hover:bg-hover hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-5 w-9 shrink-0 rounded-full border',
        'transition-colors duration-150 ease-expo',
        checked ? 'border-accent bg-accent' : 'border-border bg-elevated',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full',
          'transition-[left] duration-150 ease-expo',
          checked ? 'left-[18px] bg-accent-foreground' : 'left-0.5 bg-text-tertiary',
        )}
      />
    </button>
  );
}

/** Label above, control, then hint OR error below. Never placeholder-as-label. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-text-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-control border border-destructive/25 bg-destructive/10 px-3 py-2"
    >
      <p className="text-sm text-destructive">{children}</p>
    </div>
  );
}

/** Non-blocking message surface: success, hint, or a contextual warning. */
export function Banner({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'accent' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'border-border bg-elevated text-text-secondary',
    accent: 'border-accent-line bg-accent-muted text-accent',
    danger: 'border-destructive/25 bg-destructive/10 text-destructive',
  } as const;
  return (
    <div
      role="status"
      className={cx('rounded-control border px-3 py-2 text-sm', tones[tone], className)}
    >
      {children}
    </div>
  );
}

/* --- Status -------------------------------------------------------------- */

export type StatusTone = 'accent' | 'warning' | 'destructive' | 'neutral';

const STATUS_TONES: Record<StatusTone, { dot: string; text: string }> = {
  accent: { dot: 'bg-accent', text: 'text-accent' },
  warning: { dot: 'bg-warning', text: 'text-warning' },
  destructive: { dot: 'bg-destructive', text: 'text-destructive' },
  neutral: { dot: 'bg-text-tertiary', text: 'text-text-tertiary' },
};

export function statusTone(status: string): StatusTone {
  switch (status) {
    case 'active':
      return 'accent';
    case 'processing':
      return 'warning';
    case 'revoked':
    case 'failed':
      return 'destructive';
    default:
      return 'neutral';
  }
}

/**
 * A status dot is only used here because it encodes real, machine-derived state.
 * It is never decorative.
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[statusTone(status)];
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
      <span className={cx('text-xs', tone.text)}>{status}</span>
    </span>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'warning';
  className?: string;
}) {
  const tones = {
    neutral: 'border-border bg-elevated text-text-tertiary',
    accent: 'border-accent-line bg-accent-muted text-accent',
    warning: 'border-warning/25 bg-warning/10 text-warning',
  } as const;
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-chip border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --- Table --------------------------------------------------------------- */

/**
 * Sentence-case headers: no uppercase micro-labels, no hairline on every row.
 * `responsive-table` restacks the rows into labelled blocks below `md` (see index.css).
 *
 * `relative` is load-bearing: the action-column headings use Tailwind's `sr-only`, which is
 * `position: absolute`. Without a positioned ancestor those spans anchor to the viewport and
 * extend the *page* scroll width past the table's own overflow container.
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'responsive-table relative overflow-x-auto rounded-panel border border-border bg-surface',
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cx(
        'border-b border-border-subtle px-4 py-2.5 text-xs font-medium text-text-tertiary',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

/**
 * `label` is the column name printed beside the value once the table restacks below `md`.
 * Pass it on every cell that carries data; omit it for action cells or full-width rows.
 */
export function Td({
  children,
  align = 'left',
  label,
  span = false,
  className,
}: {
  children?: ReactNode;
  align?: 'left' | 'right' | 'center';
  label?: string;
  /** A full-width cell (empty/loading message, expanded detail). Left-aligned and unlabelled. */
  span?: boolean;
  className?: string;
}) {
  return (
    <td
      data-label={label}
      data-span={span ? '' : undefined}
      className={cx(
        'px-4 py-3 align-middle',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Row styling lives here so every table shares one hover and one divider treatment. */
export function Tr({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cx(
        'border-b border-border-subtle transition-colors duration-150 ease-expo last:border-0 hover:bg-hover',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

/* --- Feedback ------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-border bg-surface/60 px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-control border border-border bg-elevated text-text-tertiary">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-[44ch] text-xs leading-relaxed text-text-tertiary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-panel border border-destructive/25 bg-destructive/5 px-6 py-14 text-center"
    >
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* --- Data display -------------------------------------------------------- */

export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-tertiary">{label}</p>
        {icon && <span className="text-text-tertiary">{icon}</span>}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-tertiary">{hint}</p>}
    </Panel>
  );
}

/** Read-only value with an inline copy affordance. Owns its own "Copied" state. */
export function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (insecure context or denied permission) */
    }
  };

  return (
    <div className={cx('flex items-stretch gap-2', className)}>
      <div className="flex min-w-0 flex-1 items-center rounded-control border border-border bg-input px-3 py-2">
        <code
          title={value}
          className="block w-full truncate font-mono text-xs text-text-secondary select-all"
        >
          {value}
        </code>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void copy()}
        aria-live="polite"
      >
        {copied ? (
          <>
            <CheckIcon size={14} />
            Copied
          </>
        ) : (
          <>
            <CopyIcon size={14} />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}

/** Key/value row used by the "Rules" and metadata blocks. Long values wrap rather than overflow. */
export function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-text-tertiary">{label}</dt>
      <dd
        className={cx(
          // break-words keeps a long email or ID inside the panel at 320px instead of
          // widening the page; the label never wraps.
          'min-w-0 break-words text-right text-sm text-text-secondary',
          mono && 'font-mono tabular-nums',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
