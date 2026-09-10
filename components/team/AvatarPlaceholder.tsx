'use client';

/**
 * AvatarPlaceholder — Stylized wireframe radar-grid placeholder.
 *
 * Renders a dark gradient frame with a subtle radar-grid overlay,
 * a user glyph silhouette, and an "ID_PENDING" monospace label.
 * When an `src` is provided, renders the actual image instead.
 *
 * Omit `size` to fill the parent box — that is how the team cards use it, so
 * the avatar can shrink with the card on narrow screens instead of being
 * pinned to a fixed pixel edge.
 */

import Image from 'next/image';

interface AvatarPlaceholderProps {
  /** Image source — when truthy, renders the real photo. */
  src?: string;
  /** Alt text for accessibility. */
  alt: string;
  /** Fixed size in px. Omit to fill the parent element. */
  size?: number;
  /** Optional additional CSS class. */
  className?: string;
}

const fill = { width: '100%', height: '100%' } as const;

export function AvatarPlaceholder({ src, alt, size, className = '' }: AvatarPlaceholderProps) {
  const box = size ? { width: size, height: size } : fill;

  if (src) {
    return (
      <div className={`team-avatar-frame ${className}`} style={box}>
        <Image
          src={src}
          alt={alt}
          width={size ?? 128}
          height={size ?? 128}
          className="team-avatar-img"
        />
      </div>
    );
  }

  return (
    <div
      className={`team-avatar-frame team-avatar-placeholder ${className}`}
      style={box}
      aria-label={alt}
      role="img"
    >
      {/* Radar grid SVG overlay */}
      <svg
        className="team-avatar-grid"
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Concentric circles */}
        <circle cx="48" cy="48" r="12" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5" />
        <circle cx="48" cy="48" r="24" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
        <circle cx="48" cy="48" r="36" stroke="currentColor" strokeOpacity="0.055" strokeWidth="0.5" />
        <circle cx="48" cy="48" r="46" stroke="currentColor" strokeOpacity="0.04" strokeWidth="0.5" />
        {/* Cross lines */}
        <line x1="48" y1="2" x2="48" y2="94" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
        <line x1="2" y1="48" x2="94" y2="48" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
        {/* Diagonal lines */}
        <line x1="14" y1="14" x2="82" y2="82" stroke="currentColor" strokeOpacity="0.035" strokeWidth="0.5" />
        <line x1="82" y1="14" x2="14" y2="82" stroke="currentColor" strokeOpacity="0.035" strokeWidth="0.5" />
        {/* Sweep */}
        <line
          className="team-avatar-sweep"
          x1="48"
          y1="48"
          x2="82"
          y2="20"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="0.8"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 48 48"
            to="360 48 48"
            dur="9s"
            repeatCount="indefinite"
          />
        </line>
      </svg>

      {/* User silhouette glyph */}
      <svg
        className="team-avatar-glyph"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 21c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" />
      </svg>

      {/* Status label */}
      <span className="team-avatar-label">ID_PENDING</span>
    </div>
  );
}
