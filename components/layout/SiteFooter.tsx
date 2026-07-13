'use client';

import type { ComponentPropsWithoutRef, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export function SiteFooter(props: ComponentPropsWithoutRef<'footer'>) {
  const { className = '', ...rest } = props;
  const footerRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.16 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const moveAtmosphere = (event: ReactPointerEvent<HTMLElement>) => {
    const x = event.clientX / Math.max(1, window.innerWidth) - 0.5;
    const y = event.clientY / Math.max(1, window.innerHeight) - 0.5;
    footerRef.current?.style.setProperty('--footer-x', x.toFixed(3));
    footerRef.current?.style.setProperty('--footer-y', y.toFixed(3));
  };

  return (
    <footer
      {...rest}
      ref={footerRef}
      id="mission-footer"
      className={`mission-footer ${className}`}
      data-visible={visible}
      onPointerMove={moveAtmosphere}
    >
      <div className="mission-footer-orb" aria-hidden="true" />
      <div className="mission-footer-orbits" aria-hidden="true"><i /><i /><i /><b /></div>
      <div className="mission-footer-stars" aria-hidden="true" />
      <div className="mission-footer-inner">
        <div>
          <p className="mission-footer-kicker">Transmission / Earthbound</p>
          <h2>WE GO FAR.<span>WE RETURN WITH DATA.</span></h2>
        </div>

        <div>
          <div className="mission-footer-lower">
            <p className="mission-footer-intro">
              UIU Mars Rover Team is a multidisciplinary student team in Dhaka,
              Bangladesh. We design, manufacture, program, and operate planetary
              rover systems — because the fastest way to understand the future is
              to build it.
            </p>

            <div className="mission-footer-column">
              <strong>EXPLORE UMRT</strong>
              <Link href="/achievements">Achievements</Link>
              <Link href="/certificates">Certificates</Link>
              <Link href="/#part_focus_1">Rover systems</Link>
              <Link href="/#final_recenter">Teardown lab</Link>
              <a href="mailto:marsrover@uiu.ac.bd?subject=Joining%20the%20UIU%20Mars%20Rover%20Team">Join the mission</a>
            </div>

            <div className="mission-footer-column">
              <strong>OPEN CHANNEL</strong>
              <a href="mailto:marsrover@uiu.ac.bd">marsrover@uiu.ac.bd</a>
              <a href="https://www.facebook.com" target="_blank" rel="noreferrer">Facebook ↗</a>
              <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn ↗</a>
              <a href="https://www.youtube.com" target="_blank" rel="noreferrer">YouTube ↗</a>
            </div>
          </div>

          <div className="mission-footer-base">
            <span>© {new Date().getFullYear()} UIU MARS ROVER TEAM</span>
            <span>DHAKA / BANGLADESH / PLANET EARTH</span>
            <span>AD ASTRA PER ASPERA</span>
          </div>
        </div>
      </div>
      <div className="mission-footer-ticker" aria-hidden="true">
        <div>
          <span>BUILD / TEST / TRAVERSE / TRANSMIT</span>
          <span>UIU MARS ROVER TEAM / DHAKA</span>
          <span>WE RETURN WITH DATA</span>
          <span>BUILD / TEST / TRAVERSE / TRANSMIT</span>
          <span>UIU MARS ROVER TEAM / DHAKA</span>
          <span>WE RETURN WITH DATA</span>
        </div>
      </div>
    </footer>
  );
}
