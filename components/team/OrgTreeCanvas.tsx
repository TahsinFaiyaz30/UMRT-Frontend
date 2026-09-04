'use client';

/**
 * OrgTreeCanvas — View C (/team/core)
 *
 * A scroll-driven interactive hierarchical org tree.
 *
 * Desktop: wide connected branching chart with SVG connector lines
 * that illuminate on scroll.
 * Mobile (<768px): vertical accordion timeline with glowing spine.
 *
 * Features:
 * - Dynamic SVG trunk & branch lines
 * - Interactive node cards with hover elevation
 * - Click → inspect drawer
 * - Sticky mini-nav HUD for quick-jump
 * - Responsive accordion fallback
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { teamData, getMembersByDepartment, departments } from '@/data/team';
import type { TeamMember } from '@/data/team';
import { MemberCard } from './MemberCard';
import { TeamInspectDrawer } from './TeamInspectDrawer';
import { StickyTeamHUD } from './StickyTeamHUD';

// ---------------------------------------------------------------------------
// Animated SVG connector
// ---------------------------------------------------------------------------

function ConnectorLine({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`tree-connector ${className}`}
      viewBox="0 0 2 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Background trace line */}
      <line
        x1="1" y1="0" x2="1" y2="60"
        strokeWidth="2"
        strokeLinecap="round"
        stroke="rgba(255, 255, 255, 0.1)"
      />
      {/* Animated glowing draw line */}
      <motion.line
        x1="1" y1="0" x2="1" y2="60"
        strokeWidth="2"
        strokeLinecap="round"
        className="tree-connector-glow"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: '-20%' }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      />
    </svg>
  );
}

function SplitConnector() {
  return (
    <svg
      className="tree-split-connector"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Base traces */}
      <path d="M50 0 L50 15 M5 15 L95 15" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" fill="none" />
      {[5, 22, 39, 56, 73, 90].map((x) => (
        <line key={x} x1={x} y1="15" x2={x} y2="30" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="2" />
      ))}
      
      {/* Glowing animated paths */}
      <motion.path 
        d="M50 0 L50 15 M5 15 L95 15" 
        className="tree-connector-glow"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: '-20%' }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
      {[5, 22, 39, 56, 73, 90].map((x, i) => (
        <motion.line 
          key={`glow-${x}`} 
          x1={x} y1="15" x2={x} y2="30" 
          className="tree-connector-glow"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-20%' }}
          transition={{ duration: 0.4, delay: 0.6 + (i * 0.1), ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Accordion for mobile
// ---------------------------------------------------------------------------

function DeptAccordion({
  dept,
  onInspect,
}: {
  dept: typeof departments[0];
  onInspect: (m: TeamMember) => void;
}) {
  const [open, setOpen] = useState(false);
  const { lead, members } = getMembersByDepartment(dept.id);

  return (
    <div className="tree-accordion">
      <button
        type="button"
        className={`tree-accordion-trigger ${open ? 'tree-accordion-trigger--open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="tree-accordion-dot" />
        <code>{dept.sysCode}</code>
        <span>{dept.name}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="tree-accordion-chevron">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <motion.div
          className="tree-accordion-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {lead && (
            <MemberCard member={lead} variant="compact" onInspect={onInspect} />
          )}
          {members.map((m) => (
            <MemberCard key={m.id} member={m} variant="compact" onInspect={onInspect} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OrgTreeCanvas() {
  const [inspected, setInspected] = useState<TeamMember | null>(null);
  const [activeDept, setActiveDept] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deptRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Track scroll for progress bar
  const { scrollYProgress } = useScroll({ target: containerRef });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  // Intersection observer for active department
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    deptRefs.current.forEach((el, id) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveDept(id);
          }
        },
        { rootMargin: '-30% 0px -60% 0px' },
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const setDeptRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) deptRefs.current.set(id, el);
  }, []);

  const jumpToDept = useCallback((id: string) => {
    const el = deptRefs.current.get(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const hudItems = departments.map((d) => ({
    id: d.id,
    sysCode: d.sysCode,
    label: d.name,
  }));

  return (
    <section className="team-tree" aria-labelledby="team-tree-heading" ref={containerRef}>
      {/* Progress bar */}
      <motion.div className="tree-progress" style={{ width: progressWidth }} aria-hidden="true" />

      {/* Section header */}
      <div className="team-section-header">
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="team-section-line"
          aria-hidden="true"
        />
        <motion.p
          className="team-section-eyebrow"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          SYSTEM // HIERARCHY
        </motion.p>
        <motion.h1
          id="team-tree-heading"
          className="team-section-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Core Team Tree
        </motion.h1>
        <motion.p
          className="team-section-subtitle"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          The complete organizational hierarchy — from advisory oversight
          to every member building the machine.
        </motion.p>
      </div>

      {/* ── Desktop tree ── */}
      <div className="tree-desktop">
        {/* Sticky HUD */}
        <StickyTeamHUD
          departments={hudItems}
          activeId={activeDept}
          onJump={jumpToDept}
        />

        {/* Tier 1: Advisors */}
        <div className="tree-tier tree-tier--advisors">
          <div className="tree-tier-label">ADVISORY_BOARD</div>
          <div className="tree-tier-nodes">
            {teamData.advisors.map((a) => (
              <MemberCard key={a.id} member={a} variant="default" onInspect={setInspected} />
            ))}
          </div>
        </div>

        <ConnectorLine />

        {/* Tier 2: Command */}
        <div className="tree-tier tree-tier--command">
          <div className="tree-tier-label">COMMAND_NODES</div>
          <div className="tree-tier-nodes">
            <MemberCard member={teamData.teamLeader}  variant="hero" onInspect={setInspected} />
            <MemberCard member={teamData.coTeamLeader} variant="hero" onInspect={setInspected} />
          </div>
        </div>

        <ConnectorLine />

        {/* Tier 2.5: Senior Lead */}
        <div className="tree-tier tree-tier--senior">
          <div className="tree-tier-label">SENIOR_LEAD</div>
          <div className="tree-tier-nodes">
            <MemberCard member={teamData.seniorLead} variant="hero" onInspect={setInspected} />
          </div>
        </div>

        {/* Split connector */}
        <SplitConnector />

        {/* Tier 3: Department branches */}
        <div className="tree-branches">
          {departments.map((dept) => {
            const { lead, members } = getMembersByDepartment(dept.id);
            return (
              <div
                key={dept.id}
                className="tree-branch"
                ref={(el) => setDeptRef(dept.id, el)}
                data-dept={dept.id}
              >
                {/* Branch header */}
                <div className="tree-branch-header">
                  <code className="tree-branch-code">{dept.sysCode}</code>
                  <span className="tree-branch-name">{dept.name}</span>
                </div>

                {/* Sub-team lead */}
                {lead && (
                  <>
                    <ConnectorLine className="tree-connector--short" />
                    <MemberCard
                      member={lead}
                      variant="default"
                      onInspect={setInspected}
                    />
                  </>
                )}

                {/* General members */}
                <ConnectorLine className="tree-connector--short" />
                <div className="tree-member-cluster">
                  {members.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      variant="compact"
                      onInspect={setInspected}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mobile accordion ── */}
      <div className="tree-mobile">
        {/* Advisors */}
        <div className="tree-mobile-section">
          <div className="tree-mobile-label">ADVISORY_BOARD</div>
          {teamData.advisors.map((a) => (
            <MemberCard key={a.id} member={a} variant="compact" onInspect={setInspected} />
          ))}
        </div>

        <div className="tree-mobile-spine" aria-hidden="true" />

        {/* Command */}
        <div className="tree-mobile-section">
          <div className="tree-mobile-label">COMMAND_NODES</div>
          <MemberCard member={teamData.teamLeader}  variant="compact" onInspect={setInspected} />
          <MemberCard member={teamData.coTeamLeader} variant="compact" onInspect={setInspected} />
          <MemberCard member={teamData.seniorLead}   variant="compact" onInspect={setInspected} />
        </div>

        <div className="tree-mobile-spine" aria-hidden="true" />

        {/* Department accordions */}
        <div className="tree-mobile-section">
          <div className="tree-mobile-label">SUBSYSTEM_BRANCHES</div>
          {departments.map((dept) => (
            <DeptAccordion
              key={dept.id}
              dept={dept}
              onInspect={setInspected}
            />
          ))}
        </div>
      </div>

      {/* Inspect drawer */}
      <TeamInspectDrawer member={inspected} onClose={() => setInspected(null)} />
    </section>
  );
}
