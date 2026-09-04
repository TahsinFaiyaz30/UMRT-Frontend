'use client';

/**
 * LeadershipRoster — View B (/team/leads)
 *
 * Tiered command deck:
 *   Tier 1 — Faculty Advisory Board
 *   Tier 2 — Team Leader, Co-Team Leader, Overall Senior Lead
 *   Tier 3 — Sub-Team Leads grid
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { teamData } from '@/data/team';
import { MemberCard } from './MemberCard';
import { TeamInspectDrawer } from './TeamInspectDrawer';
import type { TeamMember } from '@/data/team';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export function LeadershipRoster() {
  const [inspected, setInspected] = useState<TeamMember | null>(null);

  return (
    <section className="team-leads" aria-labelledby="team-leads-heading">
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
          COMMAND // ROSTER
        </motion.p>
        <motion.h1
          id="team-leads-heading"
          className="team-section-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Leadership Deck
        </motion.h1>
        <motion.p
          className="team-section-subtitle"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          The command structure that drives every system forward — from
          institutional oversight to hands-on subsystem leadership.
        </motion.p>
      </div>

      {/* ── Tier 1: Faculty Advisory Board ── */}
      <div className="team-tier">
        <div className="team-tier-label">
          <span className="team-tier-badge">TIER-1</span>
          <span>FACULTY ADVISORY BOARD</span>
        </div>
        <motion.div
          className="team-tier-grid team-tier-grid--advisors"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {teamData.advisors.map((adv) => (
            <MemberCard
              key={adv.id}
              member={adv}
              variant="hero"
              onInspect={setInspected}
            />
          ))}
        </motion.div>
      </div>

      {/* ── Tier 2: Command Nodes ── */}
      <div className="team-tier">
        <div className="team-tier-label">
          <span className="team-tier-badge team-tier-badge--cmd">TIER-2</span>
          <span>COMMAND NODES</span>
        </div>
        <motion.div
          className="team-tier-grid team-tier-grid--command"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          <MemberCard member={teamData.teamLeader}   variant="hero" onInspect={setInspected} />
          <MemberCard member={teamData.coTeamLeader}  variant="hero" onInspect={setInspected} />
          <MemberCard member={teamData.seniorLead}    variant="hero" onInspect={setInspected} />
        </motion.div>
      </div>

      {/* ── Tier 3: Subsystem Leads ── */}
      <div className="team-tier">
        <div className="team-tier-label">
          <span className="team-tier-badge team-tier-badge--sys">TIER-3</span>
          <span>SUBSYSTEM LEADS</span>
        </div>
        <motion.div
          className="team-tier-grid team-tier-grid--leads"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
        >
          {teamData.subTeamLeads.map((lead) => (
            <MemberCard
              key={lead.id}
              member={lead}
              variant="default"
              onInspect={setInspected}
            />
          ))}
        </motion.div>
      </div>

      {/* Inspect drawer */}
      <TeamInspectDrawer member={inspected} onClose={() => setInspected(null)} />
    </section>
  );
}
