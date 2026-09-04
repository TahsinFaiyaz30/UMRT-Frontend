'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const links = [
  { href: '/#zoom_in', label: 'Machine' },
  { href: '/#part_focus_1', label: 'Systems' },
  { href: '/#final_recenter', label: 'Teardown' },
  { href: '/achievements', label: 'Achievements' },
  { href: '/certificates', label: 'Certificates' },
];

const teamDropdownLinks = [
  {
    href: '/team#about',
    label: 'About Divisions',
    desc: 'High-level system breakdown of each engineering discipline.',
    code: 'VIEW_A',
  },
  {
    href: '/team#leads',
    label: 'Leadership Deck',
    desc: 'Advisors, command leads, and subsystem lead roster.',
    code: 'VIEW_B',
  },
  {
    href: '/team#core',
    label: 'Core Team Tree',
    desc: 'Full interactive hierarchical org tree with scroll interactions.',
    code: 'VIEW_C',
  },
];

export function PremiumNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 16);
      if (window.scrollY > 16) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <header className="umrt-nav" data-scrolled={scrolled} data-open={open}>
      <div className="umrt-nav-inner">
        <Link prefetch={false} href="/" className="umrt-brand" aria-label="UMRT home" onClick={() => setOpen(false)}>
          <Image
            className="umrt-brand-logo"
            src="/umrt_logo.png"
            alt=""
            width={44}
            height={44}
            sizes="44px"
            priority
          />
          <span className="umrt-brand-copy">
            <strong>UMRT</strong>
            <small>UIU MARS ROVER TEAM</small>
          </span>
        </Link>

        <nav className="umrt-nav-links" aria-label="Primary navigation">

          <Link prefetch={false} href="/join">
            Join Us
          </Link>
          
          {/* Team link with dropdown trigger - Wrapped in a container for :hover state! */}
          <div className="umrt-team-nav-item">
            <span className="umrt-team-trigger" role="button" tabIndex={0} aria-haspopup="true">
              Team
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="umrt-team-chevron" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
            
            {/* Team hover dropdown is now a sibling inside the hovered container */}
            <div className="umrt-team-dropdown" role="menu" aria-label="Team navigation">
              <div className="umrt-team-dropdown-inner">
                <div className="umrt-team-dropdown-head" aria-hidden="true">
                  <span>TEAM // NAVIGATION</span>
                  <div className="umrt-team-dropdown-glow" />
                </div>
                
                <Link prefetch={false} href="/team/architecture" className="umrt-team-dropdown-link" role="menuitem">
                  <code className="umrt-team-dropdown-code">01</code>
                  <div>
                    <strong>System Architecture</strong>
                    <small>System teardown & divisions</small>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="umrt-team-dropdown-arrow" aria-hidden="true">
                    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                  </svg>
                </Link>

                <Link prefetch={false} href="/team/leadership" className="umrt-team-dropdown-link" role="menuitem">
                  <code className="umrt-team-dropdown-code">02</code>
                  <div>
                    <strong>Leadership Deck</strong>
                    <small>Advisors & Command Nodes</small>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="umrt-team-dropdown-arrow" aria-hidden="true">
                    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                  </svg>
                </Link>

                <Link prefetch={false} href="/team/core" className="umrt-team-dropdown-link" role="menuitem">
                  <code className="umrt-team-dropdown-code">03</code>
                  <div>
                    <strong>Core Team</strong>
                    <small>Subsystem engineers & specialists</small>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="umrt-team-dropdown-arrow" aria-hidden="true">
                    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                  </svg>
                </Link>

              </div>
            </div>
          </div>
        </nav>



        <button
          type="button"
          className="umrt-menu-toggle"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="umrt-mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
        </button>
      </div>

      <nav
        id="umrt-mobile-navigation"
        className="umrt-mobile-panel"
        aria-label="Mobile navigation"
        aria-hidden={!open}
        inert={!open ? true : undefined}
        data-lenis-prevent
      >

        <Link prefetch={false} href="/join" onClick={() => setOpen(false)}>
          Join Us
        </Link>

        {/* Team links in mobile */}
        <span className="umrt-mobile-divider">TEAM</span>
        {teamDropdownLinks.map((item) => (
          <Link prefetch={false} key={item.href} href={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </Link>
        ))}

      </nav>
    </header>
  );
}

export default PremiumNavbar;

