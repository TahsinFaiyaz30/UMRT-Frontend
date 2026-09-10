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
import { motion, useReducedMotion } from 'framer-motion';
import { useContentRecords, type CrewMember } from '@/lib/content';
import { MemberCard } from './MemberCard';
import { TeamInspectDrawer } from './TeamInspectDrawer';
import { reveal, stagger } from './reveal';

export function LeadershipRoster() {
  const [inspected, setInspected] = useState<CrewMember | null>(null);
  const { records: crew } = useContentRecords('crew');
  const { records: tiers } = useContentRecords('teamTiers');
  const { records: divisions } = useContentRecords('divisions');
  const reduce = useReducedMotion();

  const crewById = new Map(crew.map((member) => [member.id, member]));
  const sortedTiers = [...tiers].sort((a, b) => a.order - b.order);

  return (
    <section className="team-leads" aria-labelledby="team-leads-heading">
      {/* Section header */}
      <div className="team-section-header">
        <motion.div
          className="team-section-line"
          aria-hidden="true"
          {...(reduce
            ? {}
            : {
                initial: { scaleX: 0 },
                whileInView: { scaleX: 1 },
                viewport: { once: true },
                transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
              })}
        />
        <motion.p className="team-section-eyebrow" {...reveal(reduce, { y: 10, delay: 0.15 })}>
          COMMAND // ROSTER
        </motion.p>
        <motion.h1
          id="team-leads-heading"
          className="team-section-title"
          {...reveal(reduce, { y: 20, delay: 0.22 })}
        >
          Leadership Deck
        </motion.h1>
        <motion.p className="team-section-subtitle" {...reveal(reduce, { y: 14, delay: 0.3 })}>
          The command structure that drives every system forward — from
          institutional oversight to hands-on subsystem leadership.
        </motion.p>
      </div>

      {sortedTiers.map((tier) => {
        const members = tier.memberIds
          .map((id) => crewById.get(id))
          .filter((member): member is CrewMember => Boolean(member));
        if (members.length === 0) return null;

        const variant = tier.cardVariant ?? 'default';

        return (
          <div className="team-tier" key={tier.id}>
            <motion.div className="team-tier-label" {...reveal(reduce, { y: 12 })}>
              <span className="team-tier-badge">{tier.badge}</span>
              <span>{tier.label}</span>
            </motion.div>

            <motion.div
              className={`team-tier-grid team-tier-grid--${variant}`}
              {...stagger(reduce)}
            >
              {members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  variant={variant}
                  onInspect={setInspected}
                  staggered
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
