/**
 * Inline SVG icons used by the navbar + mega-menu.
 *
 * Keeping them inline (no icon library) keeps the navbar JS bundle
 * small. Each icon accepts a className so consumers can size + colour
 * via Tailwind.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function CompassIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.7 5.3-5.3 2.7 2.7-5.3 5.3-2.7Z" />
    </svg>
  );
}

export function CubeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m7 9 3 3-3 3" />
      <path d="M13 15h4" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="m5.6 5.6 2.8 2.8" />
      <path d="m15.6 15.6 2.8 2.8" />
      <path d="m5.6 18.4 2.8-2.8" />
      <path d="m15.6 8.4 2.8-2.8" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function BrandMark(props: IconProps) {
  // Compact Mars-rover-inspired glyph used next to the wordmark.
  return (
    <svg {...baseProps} {...props}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <circle cx="12" cy="16" r="3" />
      <path d="M8 11v2" />
      <path d="M16 11v2" />
      <path d="M12 13v0" />
    </svg>
  );
}

export function IconByName({
  name,
  className,
}: {
  name: 'compass' | 'cube' | 'terminal' | 'spark';
  className?: string;
}) {
  switch (name) {
    case 'compass':
      return <CompassIcon className={className} />;
    case 'cube':
      return <CubeIcon className={className} />;
    case 'terminal':
      return <TerminalIcon className={className} />;
    case 'spark':
    default:
      return <SparkIcon className={className} />;
  }
}