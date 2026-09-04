'use client';

/**
 * StickyTeamHUD — Floating side indicator for the org tree.
 *
 * Tracks the user's scroll depth and highlights which department
 * branch they're currently viewing. Offers quick-jump links.
 */

import { motion, AnimatePresence } from 'framer-motion';

interface HUDItem {
  id: string;
  sysCode: string;
  label: string;
}

interface StickyTeamHUDProps {
  departments: HUDItem[];
  activeId: string | null;
  onJump: (id: string) => void;
}

export function StickyTeamHUD({ departments, activeId, onJump }: StickyTeamHUDProps) {
  return (
    <AnimatePresence>
      <motion.nav
        className="team-hud"
        aria-label="Department quick navigation"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <div className="team-hud-header" aria-hidden="true">
          <span>SYS_NAV</span>
          <div className="team-hud-pulse" />
        </div>

        <ul className="team-hud-list">
          {departments.map((dept) => (
            <li key={dept.id}>
              <button
                type="button"
                className={`team-hud-item ${activeId === dept.id ? 'team-hud-item--active' : ''}`}
                onClick={() => onJump(dept.id)}
                aria-current={activeId === dept.id ? 'true' : undefined}
              >
                <span className="team-hud-dot" />
                <code className="team-hud-code">{dept.sysCode}</code>
                <span className="team-hud-label">{dept.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </motion.nav>
    </AnimatePresence>
  );
}
