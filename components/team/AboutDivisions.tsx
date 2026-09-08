'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { teamData, departments } from '@/data/team';

// Abstract SVGs for the graphical pane
const AbstractGraphic = ({ type }: { type: string }) => {
  switch (type) {
    case 'mechanical':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1000px' }}>
          <motion.img
            src="/images/robot_arm_transparent.png"
            alt="Mechanical System"
            style={{ 
              width: '120%', 
              maxWidth: 'none',
              objectFit: 'contain',
              // Use light drop shadow to make it glow slightly
              filter: 'drop-shadow(0 10px 20px rgba(0, 240, 255, 0.4))'
            }}
            animate={{ 
              rotateY: [-10, 15, -10],
              rotateX: [5, -5, 5],
              y: [-15, 10, -15],
              z: [0, 50, 0]
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        </div>
      );
    case 'electrical':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 50 H40 L50 20 L60 80 L70 50 H80" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="10" y="10" width="80" height="80" rx="8" strokeDasharray="8 8" />
        </svg>
      );
    case 'software':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M30 40 L20 50 L30 60 M70 40 L80 50 L70 60 M45 70 L55 30" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="10" y="10" width="80" height="80" rx="4" opacity="0.3" />
        </svg>
      );
    case 'science':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M30 80 Q50 20 70 80" />
          <circle cx="50" cy="40" r="10" />
          <circle cx="35" cy="60" r="6" />
          <circle cx="65" cy="60" r="6" />
        </svg>
      );
    case 'management':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="20" y="40" width="20" height="40" />
          <rect x="50" y="20" width="20" height="60" />
          <path d="M10 80 H90" />
          <path d="M20 40 L70 20" strokeDasharray="4 4" />
        </svg>
      );
    case 'media':
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="20" y="30" width="60" height="40" rx="4" />
          <circle cx="50" cy="50" r="10" />
          <path d="M80 35 L90 25 V75 L80 65" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="50" cy="50" r="30" />
        </svg>
      );
  }
};

export const AboutDivisions = () => {
  return (
    <section className="team-about">
      <div className="team-section-header">
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: false,}}
          className="team-section-line"
        />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false,}}
        >
          <span className="team-section-eyebrow">VIEW A // TEARDOWN</span>
          <h1 className="team-section-title">System Architecture</h1>
          <p className="team-section-subtitle">
            An inside look at the specialized engineering divisions that build, test, and operate the rover.
          </p>
        </motion.div>
      </div>

      <div className="team-about-list">
        {departments.map((division, idx) => (
          <div key={division.id} className="team-division-block">
            {/* Graphic pane */}
            <motion.div
              className="team-division-graphic"
              initial={{ opacity: 0, scale: 0.8, x: idx % 2 === 0 ? 100 : -100, borderRadius: '50%', filter: 'blur(10px)' }}
              whileInView={{ opacity: 1, scale: 1, x: 0, borderRadius: '16px', filter: 'blur(0px)' }}
              viewport={{ once: false,}}
              transition={{ duration: 1, type: 'spring', bounce: 0.3 }}
            >
              <AbstractGraphic type={division.id} />
            </motion.div>

            {/* Content pane */}
            <motion.div
              className="team-division-content"
              initial={{ opacity: 0, x: idx % 2 === 0 ? -100 : 100, filter: 'blur(10px)' }}
              whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              viewport={{ once: false,}}
              transition={{ duration: 1, type: 'spring', bounce: 0.3, delay: 0.1 }}
            >
              <div className="team-division-head">
                <span className="team-division-code">SYS_{division.id.toUpperCase()}</span>
                <h2 className="team-division-name">{division.name}</h2>
              </div>
              <p className="team-division-desc">{division.description}</p>
              
              <ul className="team-division-highlights">
                {division.highlights.map((item, i) => (
                  <li key={i}>
                    <div className="team-division-bullet" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              
              <div className="team-division-specs">
                {division.specs?.map((spec, i) => (
                  <div key={i} className="team-spec-pill">
                    <code>{spec.label}</code>
                    <strong>{spec.value}</strong>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
};
