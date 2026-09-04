'use client';

/**
 * MemberCard — Reusable telemetry-styled team member card.
 *
 * Used across all three team views. Shows avatar (or placeholder),
 * name, role badge, department tag, and optional social links.
 */

import { motion } from 'framer-motion';
import type { TeamMember } from '@/data/team';
import { AvatarPlaceholder } from './AvatarPlaceholder';

interface MemberCardProps {
  member: TeamMember;
  /** Visual size variant. */
  variant?: 'default' | 'hero' | 'compact';
  /** When provided, clicking the card triggers this callback. */
  onInspect?: (member: TeamMember) => void;
  /** Extra class names. */
  className?: string;
}

export function MemberCard({
  member,
  variant = 'default',
  onInspect,
  className = '',
}: MemberCardProps) {
  const avatarSize = variant === 'hero' ? 120 : variant === 'compact' ? 56 : 80;

  return (
    <motion.article
      className={`team-member-card team-member-card--${variant} ${className}`}
      tabIndex={0}
      role={onInspect ? 'button' : undefined}
      aria-label={`${member.name} — ${member.role}`}
      onClick={() => onInspect?.(member)}
      onKeyDown={(e) => {
        if (onInspect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onInspect(member);
        }
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      initial={{ opacity: 0, y: 20}}
      whileInView={{ opacity: 1, y: 0}}
      viewport={{ once: false, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Glow accent */}
      <div className="team-card-glow" aria-hidden="true" />

      <AvatarPlaceholder
        src={member.avatarUrl}
        alt={member.name}
        size={avatarSize}
      />

      <div className="team-card-info">
        <h3 className="team-card-name">{member.name}</h3>
        <p className="team-card-role">{member.role}</p>
        <code className="team-card-tag">{member.roleTag}</code>

        {member.focus && member.focus.length > 0 && (
          <div className="team-card-focus">
            {member.focus.map((f) => (
              <span key={f} className="team-pill">{f}</span>
            ))}
          </div>
        )}

        {member.socials && (
          <div className="team-card-socials">
            {member.socials.linkedin && (
              <a href={member.socials.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <LinkedInIcon />
              </a>
            )}
            {member.socials.github && (
              <a href={member.socials.github} target="_blank" rel="noreferrer" aria-label="GitHub">
                <GitHubIcon />
              </a>
            )}
            {member.socials.email && (
              <a href={`mailto:${member.socials.email}`} aria-label="Email">
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
    <svg viewBox="0 0 24 24" fill="currentColor" className="team-social-icon">
      <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="team-social-icon">
      <path d="M12 2A10 10 0 002 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="team-social-icon">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
    </svg>
  );
}
