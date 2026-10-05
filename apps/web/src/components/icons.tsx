import type { ReactNode, SVGProps } from 'react';

/**
 * Single icon module for the dashboard.
 *
 * The project standardises on ONE outline family at a single stroke width (1.5) so the shell
 * and every page read as the same product. Before this file, each component carried its own
 * inline <svg> with a locally chosen strokeWidth, which is what produced the inconsistency.
 *
 * Do not add a second icon family. If a glyph is missing, add it here with the same 24x24
 * outline geometry rather than mixing in another library.
 */
const STROKE_WIDTH = 1.5;

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  /** Rendered edge length in px. Defaults to 16 so icons sit on the 4px grid. */
  size?: number;
};

function IconBase({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* --- Navigation ---------------------------------------------------------- */

export const LinksIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </IconBase>
);

export const UploadIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </IconBase>
);

export const GroupsIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </IconBase>
);

export const KeyIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </IconBase>
);

export const TeamIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </IconBase>
);

export const AuditIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </IconBase>
);

export const SettingsIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </IconBase>
);

/* --- Actions & controls -------------------------------------------------- */

export const MenuIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </IconBase>
);

export const CloseIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M6 18L18 6M6 6l12 12" />
  </IconBase>
);

export const CheckIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M5 13l4 4L19 7" />
  </IconBase>
);

export const CopyIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </IconBase>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </IconBase>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M15 19l-7-7 7-7" />
  </IconBase>
);

export const ChevronRightIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 5l7 7-7 7" />
  </IconBase>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </IconBase>
);

export const PlusIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 4v16m8-8H4" />
  </IconBase>
);

export const TrashIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </IconBase>
);

export const SearchIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
  </IconBase>
);

/* --- Status & semantics -------------------------------------------------- */

export const LockIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </IconBase>
);

export const ShieldIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </IconBase>
);

export const ClockIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </IconBase>
);

export const AlertIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </IconBase>
);

export const BellIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </IconBase>
);

export const FileIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </IconBase>
);

export const EyeIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </IconBase>
);

/** Indeterminate progress ring. Pair with a text label; never the only affordance. */
export const Spinner = ({ size = 16, className = '', ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={`animate-spin ${className}`}
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
