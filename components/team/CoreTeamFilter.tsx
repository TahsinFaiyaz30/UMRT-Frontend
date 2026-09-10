'use client';

/**
 * CoreTeamFilter — View C (/team/core)
 *
 * A tab per division, and an org tree for the selected one: the subsystem
 * lead on top, then its crew split across a few columns.
 *
 * The tree renders from one markup at every width — it used to carry a
 * desktop-only branch that CSS hid below 768px, with no mobile counterpart,
 * so the whole roster vanished on phones.
 */

import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useContentRecords, type CrewMember } from '@/lib/content';
import { MemberCard } from './MemberCard';
import { TeamInspectDrawer } from './TeamInspectDrawer';
import { reveal, stagger } from './reveal';

/** At most four columns, and never a column holding a single person while
 *  another sits empty — a fixed four-way split left "cells" of one. */
function columnCountFor(memberCount: number) {
  if (memberCount <= 1) return 1;
  return Math.min(4, Math.ceil(memberCount / 2));
}

/** Round-robin distribution across N columns — works for any member count. */
function buildColumns<T>(items: T[], columnCount: number): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, i) => columns[i % columnCount].push(item));
  return columns.filter((column) => column.length > 0);
}

export function CoreTeamFilter() {
  const { records: crew } = useContentRecords('crew');
  const { records: divisions } = useContentRecords('divisions');
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [inspected, setInspected] = useState<CrewMember | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useReducedMotion();

  if (divisions.length === 0) return null;

  const crewById = new Map(crew.map((member) => [member.id, member]));
  const activeDept = divisions.find((d) => d.id === activeDeptId) ?? divisions[0];
  const activeIndex = divisions.findIndex((d) => d.id === activeDept.id);

  const lead = activeDept.leadId ? crewById.get(activeDept.leadId) ?? null : null;
  const members = activeDept.memberIds
    .map((id) => crewById.get(id))
    .filter((member): member is CrewMember => Boolean(member));
  const columns = buildColumns(members, columnCountFor(members.length));

  /** Roving-tabindex arrow navigation, as expected of a tablist. */
  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();

    const last = divisions.length - 1;
    const next =
      e.key === 'ArrowRight' ? (activeIndex === last ? 0 : activeIndex + 1)
      : e.key === 'ArrowLeft' ? (activeIndex === 0 ? last : activeIndex - 1)
      : e.key === 'Home' ? 0
      : last;

    setActiveDeptId(divisions[next].id);
    tabRefs.current[next]?.focus();
  };

  const treeClasses = [
    'team-tree',
    lead ? '' : 'team-tree--no-lead',
    columns.length <= 1 ? 'team-tree--single' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // Accent stays on the site palette rather than `division.color`, whose
    // stock hues are off-brand here.
    <section className="team-core-filter" aria-labelledby="core-team-heading">
      <div className="team-section-header">
        <motion.div
          className="team-section-line"
          aria-hidden="true"
          {...(reduce
            ? {}
            : {
                initial: { scaleX: 0 },
                animate: { scaleX: 1 },
                transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
              })}
        />
        <motion.p className="team-section-eyebrow" {...reveal(reduce, { y: 10, delay: 0.15 })}>
          SYS_CORE // PERSONNEL
        </motion.p>
        <motion.h1 id="core-team-heading" className="team-section-title" {...reveal(reduce, { y: 20, delay: 0.22 })}>
          Core Team
        </motion.h1>
        <motion.p className="team-section-subtitle" {...reveal(reduce, { y: 14, delay: 0.3 })}>
          Select a subsystem below to inspect the engineers and scientists
          responsible for building the machine.
        </motion.p>
      </div>

      <div className="team-filter-container">
        {/* Navigation tabs */}
        <div className="team-filter-tabs" role="tablist" aria-label="Engineering divisions">
          {divisions.map((dept, i) => {
            const isActive = dept.id === activeDept.id;
            return (
              <button
                key={dept.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${dept.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${dept.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveDeptId(dept.id)}
                onKeyDown={onTabKeyDown}
                className={`team-filter-tab ${isActive ? 'team-filter-tab--active' : ''}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="active-tab-indicator"
                    className="team-filter-tab-indicator"
                    aria-hidden="true"
                    transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="team-filter-tab-label">{dept.name}</span>
                <code className="team-filter-tab-code">{dept.sysCode}</code>
              </button>
            );
          })}
        </div>

        {/* Selected division. Keyed so it remounts and replays its entrance —
            no exit animation to wait on, so the panel is never left empty. */}
        <motion.div
          key={activeDept.id}
          className="team-filter-panel"
          role="tabpanel"
          id={`panel-${activeDept.id}`}
          aria-labelledby={`tab-${activeDept.id}`}
          tabIndex={0}
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 16 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
              })}
        >
          <div className="team-filter-panel-header">
            <h2>{activeDept.name} Division</h2>
            <p>{activeDept.description}</p>
          </div>

          <div className={treeClasses}>
            {lead && (
              <>
                <div className="tree-lead">
                  <div className="tree-tier-label">Subsystem Lead</div>
                  <div className="tree-lead-node">
                    <MemberCard member={lead} variant="hero" onInspect={setInspected} />
                  </div>
                </div>
                <div className="tree-trunk" aria-hidden="true" />
              </>
            )}

            {columns.length > 0 && (
              <motion.div
                className="tree-branches"
                style={{ '--cols': columns.length } as React.CSSProperties}
                {...stagger(reduce, 0.08)}
              >
                <div className="tree-rail" aria-hidden="true" />

                {columns.map((colMembers, colIndex) => (
                  <div key={colIndex} className="tree-branch">
                    <div className="tree-branch-header">
                      <span className="tree-branch-code">
                        {activeDept.sysCode}-{String(colIndex + 1).padStart(2, '0')}
                      </span>
                      <strong className="tree-branch-name">Engineering Cell {colIndex + 1}</strong>
                    </div>

                    <div className="tree-member-cluster">
                      {colMembers.map((m) => (
                        <div key={m.id} className="tree-member-node">
                          <MemberCard member={m} variant="default" onInspect={setInspected} staggered />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {!lead && columns.length === 0 && (
              <p className="tree-empty">No personnel are currently listed for this division.</p>
            )}
          </div>
        </motion.div>
      </div>

      <TeamInspectDrawer member={inspected} onClose={() => setInspected(null)} divisions={divisions} />
    </section>
  );
}
