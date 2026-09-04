'use client';

/**
 * AvatarPlaceholder — Stylized wireframe radar-grid placeholder.
 *
 * Renders a dark gradient frame with a subtle radar-grid overlay,
 * a user glyph silhouette, and an "ID_PENDING" monospace label.
 * When an `src` is provided, renders the actual image instead.
 */

import Image from 'next/image';

interface AvatarPlaceholderProps {
  /** Image source — when truthy, renders the real photo. */
  src?: string;
  /** Alt text for accessibility. */
  alt: string;
  /** Size in pixels (applies to both width and height). Default: 96 */
  size?: number;
  /** Optional additional CSS class. */
  className?: string;
}

export function AvatarPlaceholder({
  src,
  alt,
  size = 96,
  className = '',
}: AvatarPlaceholderProps) {
  if (src) {
    return (
      <div
        className={`team-avatar-frame ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="team-avatar-img"
        />
      </div>
    );
  }

  return (
    <div
      className={`team-avatar-frame team-avatar-placeholder ${className}`}
      style={{ width: size, height: size }}
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
      >
        {/* Concentric circles */}
        <circle cx="48" cy="48" r="12" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
        <circle cx="48" cy="48" r="24" stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.5" />
        <circle cx="48" cy="48" r="36" stroke="currentColor" strokeOpacity="0.04" strokeWidth="0.5" />
        <circle cx="48" cy="48" r="46" stroke="currentColor" strokeOpacity="0.03" strokeWidth="0.5" />
        {/* Cross lines */}
        <line x1="48" y1="2" x2="48" y2="94" stroke="currentColor" strokeOpacity="0.05" strokeWidth="0.5" />
        <line x1="2" y1="48" x2="94" y2="48" stroke="currentColor" strokeOpacity="0.05" strokeWidth="0.5" />
        {/* Diagonal lines */}
        <line x1="14" y1="14" x2="82" y2="82" stroke="currentColor" strokeOpacity="0.03" strokeWidth="0.5" />
        <line x1="82" y1="14" x2="14" y2="82" stroke="currentColor" strokeOpacity="0.03" strokeWidth="0.5" />
        {/* Sweep */}
        <line x1="48" y1="48" x2="82" y2="20" stroke="#00F0FF" strokeOpacity="0.15" strokeWidth="0.8">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 48 48"
            to="360 48 48"
            dur="8s"
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
