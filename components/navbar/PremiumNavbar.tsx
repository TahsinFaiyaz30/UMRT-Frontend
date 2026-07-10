'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const links = [
  { href: '/#zoom_in', label: 'Machine' },
  { href: '/#part_focus_1', label: 'Systems' },
  { href: '/#final_recenter', label: 'Teardown' },
  { href: '/achievements', label: 'Achievements' },
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
        <Link href="/" className="umrt-brand" aria-label="UMRT home" onClick={() => setOpen(false)}>
          <span className="umrt-brand-mark" aria-hidden="true" />
          <span className="umrt-brand-copy">
            <strong>UMRT</strong>
            <small>UIU MARS ROVER TEAM</small>
          </span>
        </Link>

        <nav className="umrt-nav-links" aria-label="Primary navigation">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
        </nav>

        <Link href="/#free_explore_unlock" className="umrt-nav-action">
          EXPLORE <span>↗</span>
        </Link>

        <button
          type="button"
          className="umrt-menu-toggle"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
        </button>
      </div>

      <div className="umrt-nav-hover-panel">
        <div className="umrt-nav-hover-inner">
          <div className="umrt-nav-hover-column">
            <span>THE MACHINE</span>
            <Link href="/#part_focus_1"><b>Vision mast</b><small>Stereo perception + terrain intelligence.</small></Link>
            <Link href="/#part_focus_2"><b>Science arm</b><small>Sample handling and field manipulation.</small></Link>
            <Link href="/#part_focus_3"><b>Mobility</b><small>Rocker-bogie traversal architecture.</small></Link>
          </div>

          <div className="umrt-nav-hover-column">
            <span>THE MISSION</span>
            <Link href="/achievements"><b>Competition archive</b><small>Eight milestones across five seasons.</small></Link>
            <Link href="/#system_teardown"><b>System teardown</b><small>Inspect the rover by subsystem.</small></Link>
            <Link href="/#free_explore_unlock"><b>Free 3D lab</b><small>Orbit, pan, zoom, and control the explosion.</small></Link>
          </div>

          <Link href="/#free_explore_unlock" className="umrt-nav-hover-feature">
            <span>ENGINEERING BRIEF</span>
            <strong>ROVER<br />SYSTEM 04</strong>
            <p>A complete interactive surface for exploring the machine UMRT takes beyond the road.</p>
            <b>ENTER THE LAB <i>→</i></b>
          </Link>
        </div>
      </div>

      <nav className="umrt-mobile-panel" aria-label="Mobile navigation" data-lenis-prevent>
        {links.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>
        ))}
        <Link href="/#free_explore_unlock" onClick={() => setOpen(false)}>Explore model</Link>
      </nav>
    </header>
  );
}

export default PremiumNavbar;
