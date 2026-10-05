import { useCallback, useEffect, useRef, useState } from 'react';
import { MorphIcon } from 'morphicons/react';
import type { IconInput } from 'morphicons/react';
import {
  ArrowUpRight,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  CloudUpload,
  Copy,
  ExternalLink,
  LoaderCircle,
  LogIn,
  LogOut,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UserPlus,
} from 'lucide';

/**
 * Morphing icons.
 *
 * `morphicons` animates between two Lucide icons with spring physics and consumes Lucide
 * *data*, so the icons here come from the vanilla `lucide` package while the static ones in
 * `./icons.tsx` come from `lucide-react`. That split is the library's documented design
 * (data and component packages coexist, both tree-shake); keep the two versions aligned so
 * a morphing icon matches its static twin exactly.
 */

export { MorphIcon };
export type { IconInput };

/** Lucide data for every icon that morphs. */
export const glyph = {
  busy: LoaderCircle,
  done: Check,
  copy: Copy,
  trash: Trash2,
  plus: Plus,
  upload: CloudUpload,
  save: Save,
  disable: PowerOff,
  enable: Power,
  send: Send,
  retry: RefreshCw,
  checkAll: CheckCheck,
  logout: LogOut,
  login: LogIn,
  signup: UserPlus,
  more: ChevronDown,
  upgrade: ArrowUpRight,
  external: ExternalLink,
  block: Ban,
} as const;

export type ActionStatus = 'idle' | 'busy' | 'done';

/**
 * A morphing icon with the dashboard's presentation defaults.
 *
 * `reducedMotion="user"` is deliberate: morphicons animates regardless of the OS setting
 * unless asked otherwise, and this surface should follow the user's preference.
 */
export function MorphGlyph({
  icon,
  size = 14,
  className,
  label,
}: {
  icon: IconInput;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <MorphIcon
      icon={icon}
      size={size}
      strokeWidth={1.5}
      spring="snappy"
      reducedMotion="user"
      className={className}
      label={label}
    />
  );
}

/**
 * Drives one button's `idle -> busy -> done -> idle` cycle.
 *
 * The wrapped function signals failure by returning `false`; anything else counts as
 * success. That is explicit on purpose: these handlers swallow their own errors into
 * component state, so a resolved promise is not evidence that the work succeeded and
 * morphing to a tick on a failed request would be a lie.
 */
export function useActionStatus(holdMs = 1500) {
  const [status, setStatus] = useState<ActionStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      clearTimeout(timer.current);
      setStatus('busy');
      let succeeded = false;
      try {
        succeeded = (await fn()) !== false;
      } catch {
        succeeded = false;
      }
      if (!succeeded) {
        setStatus('idle');
        return false;
      }
      setStatus('done');
      timer.current = setTimeout(() => setStatus('idle'), holdMs);
      return true;
    },
    [holdMs],
  );

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setStatus('idle');
  }, []);

  return { status, run, reset, busy: status === 'busy' };
}
