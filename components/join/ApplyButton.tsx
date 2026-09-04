'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ApplyButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate backend connection delay
    setTimeout(() => {
      console.log('Form data ready to be sent to backend.');
      setIsSubmitting(false);
      setIsOpen(false);
      alert('Application placeholder submitted! Backend connection pending.');
    }, 1500);
  };

  return (
    <>
      <button className="join-button" onClick={() => setIsOpen(true)}>
        APPLY
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="team-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              className="apply-modal"
              initial={{ opacity: 0, scale: 0.95, y: '-50%', x: '-50%' }}
              animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, y: '-50%', x: '-50%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
            >
              <button
                className="team-drawer-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close form"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>

              <div className="apply-modal-content">
                <h2>Join The Team</h2>
                <p>Fill out the application form below to begin your journey with UMRT.</p>

                <form onSubmit={handleSubmit} className="apply-form">
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input type="text" id="name" required placeholder="John Doe" />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="email">University Email</label>
                    <input type="email" id="email" required placeholder="jdoe@uiu.edu" />
                  </div>

                  <div className="form-group">
                    <label htmlFor="department">Target Division</label>
                    <select id="department" required defaultValue="">
                      <option value="" disabled>Select a division...</option>
                      <option value="software">Software & Autonomous Systems</option>
                      <option value="mechanical">Mechanical & Rover Chassis</option>
                      <option value="electrical">Electrical & Power Systems</option>
                      <option value="science">Life Science & Astrobiology</option>
                      <option value="management">Management & Operations</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="motivation">Why do you want to join?</label>
                    <textarea id="motivation" rows={4} required placeholder="Tell us about your passion for space and robotics..." />
                  </div>

                  <button type="submit" className="submit-button" disabled={isSubmitting}>
                    {isSubmitting ? 'TRANSMITTING...' : 'SUBMIT APPLICATION'}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
