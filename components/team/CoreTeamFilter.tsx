'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { useContentRecords, type CrewMember } from '@/lib/content';
import { MemberCard } from './MemberCard';
import { TeamInspectDrawer } from './TeamInspectDrawer';

function ScrollLinkedLine({ x1, y1, x2, y2, d, className, viewBox, preserveAspectRatio, style, width, height }: any) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 35%"]
  });

  return (
    <svg ref={ref} className={className} width={width} height={height} viewBox={viewBox} preserveAspectRatio={preserveAspectRatio} style={style}>
      {d ? (
        <motion.path
          d={d} fill="none" strokeWidth="2"
          style={{ stroke: 'var(--team-color)', filter: 'drop-shadow(0 0 6px var(--team-color))', pathLength: scrollYProgress }}
        />
      ) : (
        <motion.line
          x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="2"
          style={{ stroke: 'var(--team-color)', filter: 'drop-shadow(0 0 6px var(--team-color))', pathLength: scrollYProgress }}
        />
      )}
    </svg>
  );
}

function ScrollLinkedDot() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "start 60%"]
  });

  return (
    <motion.div
      ref={ref}
      style={{
        position: 'absolute', top: -4, left: 'calc(50% - 4px)', width: 8, height: 8, borderRadius: '50%', background: 'var(--team-color)', zIndex: 20, boxShadow: '0 0 10px var(--team-color)',
        scale: scrollYProgress, opacity: scrollYProgress
      }}
    />
  );
}

/** Round-robin distribution across N columns — works for any member count, unlike a fixed slice. */
function buildColumns<T>(items: T[], columnCount: number): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, i) => columns[i % columnCount].push(item));
  return columns.filter((column) => column.length > 0);
}

const DEFAULT_TEAM_COLOR = '#00F0FF';

export function CoreTeamFilter() {
  const { records: crew } = useContentRecords('crew');
  const { records: divisions } = useContentRecords('divisions');
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [inspected, setInspected] = useState<CrewMember | null>(null);

  if (divisions.length === 0) return null;

  const crewById = new Map(crew.map((member) => [member.id, member]));
  const activeDept = divisions.find((d) => d.id === activeDeptId) ?? divisions[0];
  const activeColor = activeDept.color ?? DEFAULT_TEAM_COLOR;

  const lead = activeDept.leadId ? crewById.get(activeDept.leadId) ?? null : null;
  const members = activeDept.memberIds
    .map((id) => crewById.get(id))
    .filter((member): member is CrewMember => Boolean(member));
  const columns = buildColumns(members, Math.min(4, members.length || 1));

  return (
    <section className="team-core-filter" aria-labelledby="core-team-heading" style={{ '--team-color': activeColor } as React.CSSProperties}>
      <div className="team-section-header">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8 }}
          className="team-section-line"
          aria-hidden="true"
        />
        <motion.p
          className="team-section-eyebrow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          SYS_CORE // PERSONNEL
        </motion.p>
        <motion.h1
          id="core-team-heading"
          className="team-section-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Core Team
        </motion.h1>
        <motion.p
          className="team-section-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Select a subsystem below to inspect the engineers and scientists
          responsible for building the machine.
        </motion.p>
      </div>

      <div className="team-filter-container">
        {/* Navigation Tabs */}
        <div className="team-filter-tabs" role="tablist">
          {divisions.map((dept) => {
            const isActive = dept.id === activeDept.id;
            return (
              <button
                key={dept.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${dept.id}`}
                onClick={() => setActiveDeptId(dept.id)}
                className={`team-filter-tab ${isActive ? 'team-filter-tab--active' : ''}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="team-filter-tab-indicator"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="team-filter-tab-label">{dept.name}</span>
                <code className="team-filter-tab-code">{dept.sysCode}</code>
              </button>
            );
          })}
        </div>

        {/* Selected Department Display */}
        <div className="team-filter-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeDept.id}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="team-filter-panel"
              role="tabpanel"
              id={`panel-${activeDept.id}`}
            >
              <div className="team-filter-panel-header">
                <h2>{activeDept.name} Division</h2>
                <p>{activeDept.description}</p>
              </div>

              <div className="team-tree">
                <div className="tree-desktop">
                  {/* Lead Tier */}
                  <div className="tree-tier">
                    <div className="tree-tier-label">SUBSYSTEM LEAD</div>
                    <div className="tree-tier-nodes">
                      {lead && <MemberCard member={lead} variant="hero" onInspect={setInspected} />}
                    </div>
                  </div>

                  {/* Main Trunk */}
                  <ScrollLinkedLine className="tree-connector" viewBox="0 0 2 60" x1="1" y1="0" x2="1" y2="60" />

                  {/* Splitter */}
                  <ScrollLinkedLine className="tree-split-connector" viewBox="0 0 1000 30" preserveAspectRatio="none" d="M 500 0 L 500 15 M 500 15 L 125 15 L 125 30 M 500 15 L 375 15 L 375 30 M 500 15 L 625 15 L 625 30 M 500 15 L 875 15 L 875 30" />

                  {/* Branches — one column per group in the round-robin split */}
                  <div className="tree-branches">
                    {columns.map((colMembers, colIndex) => (
                      <div key={colIndex} className="tree-branch">
                        <div className="tree-branch-header">
                          <span className="tree-branch-code">{activeDept.sysCode}-0{colIndex + 1}</span>
                          <strong className="tree-branch-name">Engineering Cell {colIndex + 1}</strong>
                        </div>
                        <div className="tree-member-cluster" style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
                          {colMembers.map((m, i) => (
                            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                              {i > 0 && (
                                <ScrollLinkedLine width="2" height="30" viewBox="0 0 2 30" style={{ overflow: 'visible' }} x1="1" y1="0" x2="1" y2="30" />
                              )}
                              <div style={{ position: 'relative', width: '100%' }}>
                                <ScrollLinkedDot />
                                <MemberCard member={m} variant="default" onInspect={setInspected} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <TeamInspectDrawer member={inspected} onClose={() => setInspected(null)} divisions={divisions} />
    </section>
  );
}
