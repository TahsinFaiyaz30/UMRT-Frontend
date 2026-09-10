'use client';

/**
 * TeamInspectDrawer — Slide-out panel for detailed member inspection.
 *
 * Triggered by clicking a node card in any team view. Shows full
 * telemetry-styled detail: name, avatar, role, division, focus
 * areas, and social links.
 */

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { CrewMember, DivisionRecord, MediaAsset } from '@/lib/content';
import { MediaImage } from '@/components/media/MediaImage';
import { AvatarPlaceholder } from './AvatarPlaceholder';
import { roleTag } from './MemberCard';

interface TeamInspectDrawerProps {
  member: CrewMember | null;
  onClose: () => void;
  /** Used to look up and display the member's division, when known. */
  divisions?: DivisionRecord[];
}

export function TeamInspectDrawer({ member, onClose, divisions = [] }: TeamInspectDrawerProps) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

  const division = member
    ? divisions.find((d) => d.leadId === member.id || d.memberIds.includes(member.id))
    : undefined;
  const portrait =
    member?.portrait && typeof member.portrait === 'object' ? (member.portrait as MediaAsset) : null;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!member) return undefined;

    // Move focus into the dialog, and hand it back to whatever opened it.
    restoreFocusTo.current = document.activeElement;
    closeRef.current?.focus();

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (restoreFocusTo.current instanceof HTMLElement) restoreFocusTo.current.focus();
    };
  }, [member, handleKeyDown]);

  const centered = { y: '-50%', x: '-50%' } as const;

  return (
    <AnimatePresence>
      {member && (
        <>
          {/* Backdrop */}
          <motion.div
            className="team-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.aside
            className="team-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Inspect ${member.name}`}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96, ...centered }}
            animate={{ opacity: 1, scale: 1, ...centered }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.96, ...centered }}
            transition={reduce ? { duration: 0 } : { type: 'spring', damping: 26, stiffness: 320 }}
          >
            <button
              ref={closeRef}
              className="team-drawer-close"
              onClick={onClose}
              aria-label="Close panel"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="team-drawer-content">
              {/* Header */}
              <div className="team-drawer-header">
                <div
                  className="team-drawer-avatar"
                  style={{ '--avatar-size': 'clamp(96px, 30vw, 128px)' } as React.CSSProperties}
                >
                  {portrait ? (
                    <MediaImage asset={portrait} ratio={1} sizes="128px" className="team-avatar-frame" alt={member.name} />
                  ) : (
                    <AvatarPlaceholder alt={member.name} />
                  )}
                </div>
                <div className="team-drawer-scanline" aria-hidden="true" />
              </div>

              {/* Identity */}
              <div className="team-drawer-identity">
                <code className="team-drawer-tag">{roleTag(member.role)}</code>
                <h2>{member.name}</h2>
                <p className="team-drawer-role">{member.role}</p>
              </div>

              {/* Division */}
              {division && (
                <div className="team-drawer-section">
                  <span className="team-drawer-label">ASSIGNED_DIVISION</span>
                  <p>
                    <code>{division.sysCode}</code>{' // '}{division.name}
                  </p>
                </div>
              )}

              {/* Focus */}
              {member.focus && member.focus.length > 0 && (
                <div className="team-drawer-section">
                  <span className="team-drawer-label">FOCUS_MODULES</span>
                  <div className="team-drawer-pills">
                    {member.focus.map((f) => (
                      <span key={f} className="team-pill">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Socials */}
              {member.socials && (
                <div className="team-drawer-section">
                  <span className="team-drawer-label">EXTERNAL_LINKS</span>
                  <div className="team-drawer-links">
                    {member.socials.linkedin && (
                      <a href={member.socials.linkedin} target="_blank" rel="noreferrer">
                        LinkedIn ↗
                      </a>
                    )}
                    {member.socials.github && (
                      <a href={member.socials.github} target="_blank" rel="noreferrer">
                        GitHub ↗
                      </a>
                    )}
                    {member.socials.email && (
                      <a href={`mailto:${member.socials.email}`}>
                        {member.socials.email}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Status bar */}
              <div className="team-drawer-status" aria-hidden="true">
                <span>STATUS: ACTIVE</span>
                <span>CLEARANCE: LEVEL-3</span>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
