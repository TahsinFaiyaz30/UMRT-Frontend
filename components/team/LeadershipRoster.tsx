'use client';

/**
 * LeadershipRoster — View B (/team/leadership)
 *
 * Renders whatever tiers `teamTiers` defines, in `order`, each populated by
 * its own `memberIds` against the `crew` roster. Nothing here is hardcoded to
 * a tier count, label, or membership rule — a backend can rename a tier,
 * reorder tiers, or add a new one and this renders it without a code change.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useContentRecords, type CrewMember } from '@/lib/content';
import { MemberCard } from './MemberCard';
import { TeamInspectDrawer } from './TeamInspectDrawer';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export function LeadershipRoster() {
  const [inspected, setInspected] = useState<CrewMember | null>(null);
  const { records: crew } = useContentRecords('crew');
  const { records: tiers } = useContentRecords('teamTiers');
  const { records: divisions } = useContentRecords('divisions');

  const crewById = new Map(crew.map((member) => [member.id, member]));
  const sortedTiers = [...tiers].sort((a, b) => a.order - b.order);

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

      {sortedTiers.map((tier) => {
        const members = tier.memberIds
          .map((id) => crewById.get(id))
          .filter((member): member is CrewMember => Boolean(member));
        if (members.length === 0) return null;

        return (
          <div className="team-tier" key={tier.id}>
            <div className="team-tier-label">
              <span className="team-tier-badge">{tier.badge}</span>
              <span>{tier.label}</span>
            </div>
            <motion.div
              className={`team-tier-grid team-tier-grid--${tier.cardVariant ?? 'default'}`}
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
            >
              {members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  variant={tier.cardVariant ?? 'default'}
                  onInspect={setInspected}
                />
              ))}
            </motion.div>
          </div>
        );
      })}

      {/* Inspect drawer */}
      <TeamInspectDrawer member={inspected} onClose={() => setInspected(null)} divisions={divisions} />
    </section>
  );
}
