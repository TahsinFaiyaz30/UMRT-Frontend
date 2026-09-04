'use client';

/**
 * TeamInspectDrawer — Slide-out panel for detailed member inspection.
 *
 * Triggered by clicking a node card in any team view. Shows full
 * telemetry-styled detail: name, avatar, role, department, focus
 * projects, and social links.
 */

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TeamMember } from '@/data/team';
import { getDepartment } from '@/data/team';
import { AvatarPlaceholder } from './AvatarPlaceholder';

interface TeamInspectDrawerProps {
  member: TeamMember | null;
  onClose: () => void;
}

export function TeamInspectDrawer({ member, onClose }: TeamInspectDrawerProps) {
  const department = member ? getDepartment(member.departmentId) : undefined;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (member) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [member, handleKeyDown]);

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
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.aside
            className="team-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Inspect ${member.name}`}
            initial={{ opacity: 0, scale: 0.95, y: '-50%', x: '-50%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: '-50%', x: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <button
              className="team-drawer-close"
              onClick={onClose}
              aria-label="Close panel"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="team-drawer-content">
              {/* Header */}
              <div className="team-drawer-header">
                <AvatarPlaceholder
                  src={member.avatarUrl}
                  alt={member.name}
                  size={128}
                />
                <div className="team-drawer-scanline" aria-hidden="true" />
              </div>

              {/* Identity */}
              <div className="team-drawer-identity">
                <code className="team-drawer-tag">{member.roleTag}</code>
                <h2>{member.name}</h2>
                <p className="team-drawer-role">{member.role}</p>
              </div>

              {/* Department */}
              {department && (
                <div className="team-drawer-section">
                  <span className="team-drawer-label">ASSIGNED_DIVISION</span>
                  <p>
                    <code>{department.sysCode}</code> // {department.name}
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
