import type { ComponentType, SVGProps } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CloudUpload,
  Copy,
  ExternalLink,
  Eye,
  File,
  FileText,
  KeyRound,
  LoaderCircle,
  Lock,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
  UsersRound,
  X,
} from 'lucide-react';

/**
 * Lucide icons for the dashboard.
 *
 * Every icon in this app is a Lucide icon. This module exists only to pin the two
 * presentation defaults so call sites stay terse and consistent:
 *   - `size` defaults to 16 (the dashboard's 4px grid), not Lucide's 24
 *   - `strokeWidth` defaults to 1.5, not Lucide's 2
 *
 * Icons that need to MORPH (a button's idle -> busy -> done state) cannot use these
 * components: `morphicons` consumes Lucide *data*, not React components. Those live in
 * `./morph.tsx` and come from the vanilla `lucide` package.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & { size?: number };

const DEFAULT_SIZE = 16;
const DEFAULT_STROKE = 1.5;

type AnyIcon = ComponentType<Record<string, unknown>>;

function withDefaults(Base: AnyIcon) {
  return function Icon({ size = DEFAULT_SIZE, ...rest }: IconProps) {
    return (
      <Base
        size={size}
        strokeWidth={DEFAULT_STROKE}
        aria-hidden="true"
        focusable="false"
        {...rest}
      />
    );
  };
}

/* --- Navigation ---------------------------------------------------------- */

export const LinksIcon = withDefaults(FileText as AnyIcon);
export const UploadIcon = withDefaults(CloudUpload as AnyIcon);
export const GroupsIcon = withDefaults(Users as AnyIcon);
export const KeyIcon = withDefaults(KeyRound as AnyIcon);
export const TeamIcon = withDefaults(UsersRound as AnyIcon);
export const AuditIcon = withDefaults(ClipboardList as AnyIcon);
export const SettingsIcon = withDefaults(Settings as AnyIcon);

/* --- Actions & controls -------------------------------------------------- */

export const MenuIcon = withDefaults(Menu as AnyIcon);
export const CloseIcon = withDefaults(X as AnyIcon);
export const CheckIcon = withDefaults(Check as AnyIcon);
export const CopyIcon = withDefaults(Copy as AnyIcon);
export const ArrowLeftIcon = withDefaults(ArrowLeft as AnyIcon);
export const ChevronLeftIcon = withDefaults(ChevronLeft as AnyIcon);
export const ChevronRightIcon = withDefaults(ChevronRight as AnyIcon);
export const ExternalLinkIcon = withDefaults(ExternalLink as AnyIcon);
export const PlusIcon = withDefaults(Plus as AnyIcon);
export const TrashIcon = withDefaults(Trash2 as AnyIcon);
export const SearchIcon = withDefaults(Search as AnyIcon);

/* --- Status & semantics -------------------------------------------------- */

export const LockIcon = withDefaults(Lock as AnyIcon);
export const ShieldIcon = withDefaults(ShieldCheck as AnyIcon);
export const ClockIcon = withDefaults(Clock as AnyIcon);
export const AlertIcon = withDefaults(TriangleAlert as AnyIcon);
export const FileIcon = withDefaults(File as AnyIcon);
export const EyeIcon = withDefaults(Eye as AnyIcon);
export const BellIcon = withDefaults(Bell as AnyIcon);

/**
 * Standalone progress ring, for surfaces with no morphing involved.
 * Buttons should prefer the morphing icon inside `<Button>` instead.
 */
export function Spinner({ size = DEFAULT_SIZE, className = '', ...rest }: IconProps) {
  return (
    <LoaderCircle
      size={size}
      strokeWidth={DEFAULT_STROKE}
      aria-hidden="true"
      focusable="false"
      className={`animate-spin ${className}`}
      {...rest}
    />
  );
}
