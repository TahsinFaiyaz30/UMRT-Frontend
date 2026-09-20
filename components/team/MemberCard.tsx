'use client';

/**
 * MemberCard — Reusable telemetry-styled team member card.
 *
 * Used across all three team views. Shows avatar (or placeholder),
 * name, role badge, unit tag, and optional focus/social links.
 */

import { motion, useReducedMotion } from 'framer-motion';
import type { CrewMember, MediaAsset } from '@/lib/content';
import { MediaImage } from '@/components/media/MediaImage';
import { AvatarPlaceholder } from './AvatarPlaceholder';
import { useCard3d } from './space/useCard3d';
import { staggerItem } from './reveal';

interface MemberCardProps {
  member: CrewMember;
  /** Visual size variant. */
  variant?: 'default' | 'hero' | 'compact';
  /** When provided, clicking the card triggers this callback. */
  onInspect?: (member: CrewMember) => void;
  /** Extra class names. */
  className?: string;
  /**
   * Set when the card sits inside a `stagger()` container, so the parent
   * drives the reveal instead of the card animating on its own.
   */
  staggered?: boolean;
}

/** Turns a free-form role string into a bracketed telemetry tag, e.g. "Sub-Team Lead" -> "[SUB-TEAM_LEAD]". */
export function roleTag(role: string) {
  return `[${role.toUpperCase().replace(/\s+/g, '_')}]`;
}

/** Avatar edge in px, per variant. CSS caps this again on narrow screens. */
const AVATAR_SIZE = { hero: 112, default: 84, compact: 56 } as const;

export function MemberCard({
  member,
  variant = 'default',
  onInspect,
  className = '',
  staggered = false,
}: MemberCardProps) {
  const reduce = useReducedMotion();
  const avatarSize = AVATAR_SIZE[variant];
  const portrait =
    member.portrait && typeof member.portrait === 'object' ? (member.portrait as MediaAsset) : null;
  const interactive = Boolean(onInspect);

  // Real tilt + depth, and a resonance pulse into the field behind the page.
  const card3d = useCard3d({
    max: variant === 'hero' ? 6 : 8,
    lift: variant === 'hero' ? 30 : 24,
    resonance: variant === 'hero' ? 0.75 : 0.55,
  });

  // Cards inside a staggered grid inherit the parent's timeline; standalone
  // cards reveal themselves. Either way, reduced motion renders them static.
  const motionProps = staggered
    ? staggerItem(reduce)
    : reduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px 0px' },
          transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <motion.article
      className={`team-member-card team-member-card--${variant} ${className}`}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `Inspect ${member.name} — ${member.role}` : undefined}
      onClick={interactive ? () => onInspect?.(member) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onInspect?.(member);
              }
            }
          : undefined
      }
      style={{ ...card3d.style, ...(interactive ? null : { cursor: 'default' }) }}
      {...card3d.handlers}
      {...motionProps}
    >
      {/* Glow accent */}
      <div className="team-card-glow" aria-hidden="true" />

      <div className="team-card-avatar" style={{ '--avatar-size': `${avatarSize}px` } as React.CSSProperties}>
        {portrait ? (
          <MediaImage
            asset={portrait}
            ratio={1}
            sizes={`${avatarSize}px`}
            className="team-avatar-frame"
            alt={member.name}
          />
        ) : (
          <AvatarPlaceholder alt={member.name} />
        )}
      </div>

      <div className="team-card-info">
        <h3 className="team-card-name">{member.name}</h3>
        <p className="team-card-role">{member.role}</p>
        <code className="team-card-tag">{roleTag(member.role)}</code>

        {member.focus && member.focus.length > 0 && (
          <div className="team-card-focus">
            {member.focus.map((f) => (
              <span key={f} className="team-pill">{f}</span>
            ))}
          </div>
        )}

        {member.socials && (
          // Stop propagation so following a link does not also open the
          // inspect drawer behind it.
          <div className="team-card-socials" onClick={(e) => e.stopPropagation()}>
            {member.socials.linkedin && (
              <a href={member.socials.linkedin} target="_blank" rel="noreferrer" aria-label={`${member.name} on LinkedIn`}>
                <LinkedInIcon />
              </a>
            )}
            {member.socials.github && (
              <a href={member.socials.github} target="_blank" rel="noreferrer" aria-label={`${member.name} on GitHub`}>
                <GitHubIcon />
              </a>
            )}
            {member.socials.email && (
              <a href={`mailto:${member.socials.email}`} aria-label={`Email ${member.name}`}>
                <MailIcon />
              </a>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons — keep bundle small
// ---------------------------------------------------------------------------

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="team-social-icon" aria-hidden="true">
      <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="team-social-icon" aria-hidden="true">
      <path d="M12 2A10 10 0 002 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="team-social-icon" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
    </svg>
  );
}
