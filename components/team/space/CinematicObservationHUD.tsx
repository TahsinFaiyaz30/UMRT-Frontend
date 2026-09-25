'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { flightState, isFlightControlTarget } from './spaceFlightState';

const SOLAR_DESTINATIONS = ['Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

export function CinematicObservationHUD() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [closeView, setCloseView] = useState(false);
  const [magnification, setMagnification] = useState(1);
  const [solarView, setSolarView] = useState(flightState.solarView);
  const [telemetry, setTelemetry] = useState({ name: 'Interstellar transit', sector: 1, autoDrift: true, reducedMotion: false });
  const launchButton = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const wasActive = useRef(false);

  const exitMode = useCallback(() => {
    flightState.observationMode = false;
    flightState.requestedSector = null;
    flightState.viewMagnification = 1;
    flightState.inspectSunspots = false;
    setCloseView(false);
    setMagnification(1);
    document.body.classList.remove('observation-mode-active');
    setActive(false);
  }, []);
  const toggleMode = useCallback(() => {
    const next = !flightState.observationMode;
    flightState.observationMode = next;
    document.body.classList.toggle('observation-mode-active', next);
    setActive(next);
  }, []);
  const toggleDrift = useCallback(() => {
    // Automatic motion remains off when the system requests reduced motion.
    flightState.autoDrift = !flightState.reducedMotion && !flightState.autoDrift;
    setTelemetry((previous) => ({ ...previous, autoDrift: flightState.autoDrift }));
  }, []);
  const visit = useCallback((sector: number) => {
    flightState.requestedSector = Math.max(0, sector);
    flightState.viewMagnification = 1;
    flightState.inspectSunspots = false;
    setMagnification(1);
    setCloseView(false);
    controls.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    exitMode();
    return () => {
      flightState.observationMode = false;
      document.body.classList.remove('observation-mode-active');
    };
  }, [pathname, exitMode]);

  useEffect(() => {
    if (active) controls.current?.focus({ preventScroll: true });
    else if (wasActive.current) launchButton.current?.focus({ preventScroll: true });
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && flightState.observationMode) {
        event.preventDefault();
        exitMode();
        return;
      }
      if (isFlightControlTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        toggleMode();
      } else if (event.key === ' ' && flightState.observationMode) {
        event.preventDefault();
        toggleDrift();
      }
    };
    const interval = window.setInterval(() => {
      const next = {
        name: flightState.activeSectorName,
        sector: flightState.sectorIndex + 1,
        autoDrift: flightState.autoDrift,
        reducedMotion: flightState.reducedMotion,
      };
      setTelemetry((previous) => previous.name === next.name && previous.sector === next.sector
        && previous.autoDrift === next.autoDrift && previous.reducedMotion === next.reducedMotion ? previous : next);
    }, 250);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('team-space-reset', exitMode);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('team-space-reset', exitMode);
      window.clearInterval(interval);
    };
  }, [exitMode, toggleMode, toggleDrift]);

  return (
    <>
      {!active && (
        <button
          ref={launchButton}
          type="button"
          className="observation-launch-trigger"
          onClick={toggleMode}
          title="Explore an open-ended journey through space (O)"
          aria-label="Observe universe"
        >
          <span className="pulse-dot" aria-hidden="true" />
          <span>OBSERVE UNIVERSE</span>
          <span className="observation-hint-key" aria-hidden="true">O</span>
        </button>
      )}

      {active && (
        <div ref={controls} tabIndex={-1} className="observation-hud" role="region" aria-label="Universe observation controls">
          <div className="observation-hud-top">
            <div className="observation-telemetry">
              <div className="observation-tag">DEEP SPACE OBSERVATORY</div>
              <div className="observation-target" role="status">{telemetry.name}</div>
              <div className="observation-tag">SECTOR {telemetry.sector.toLocaleString()} · {telemetry.autoDrift ? 'AUTO DRIFT' : 'MANUAL FLIGHT'}</div>
              <a className="observation-credit" href={telemetry.sector === 6 ? 'https://esahubble.org/images/heic1914b/' : '/textures/solar/SOURCES.md'} target="_blank" rel="noreferrer">
                {telemetry.sector === 6 ? 'Image: NASA, ESA, A. Simon (Goddard Space Flight Center), and M.H. Wong (University of California, Berkeley)' : 'Image & observation credits'}
              </a>
            </div>
            <div className="observation-controls">
              <button
                type="button"
                className="observation-exit-btn observation-drift-btn"
                onClick={toggleDrift}
                aria-pressed={telemetry.autoDrift}
                disabled={telemetry.reducedMotion}
                title={telemetry.reducedMotion ? 'Automatic drift is off for reduced motion' : 'Toggle automatic drift'}
              >
                {telemetry.reducedMotion ? 'DRIFT OFF' : telemetry.autoDrift ? 'PAUSE DRIFT' : 'START DRIFT'}
              </button>
              <button type="button" className="observation-exit-btn" onClick={exitMode}>
                <span>RETURN TO TEAM</span>
                <span className="observation-hint-key" aria-hidden="true">ESC</span>
              </button>
            </div>
          </div>
          <div className="observation-hud-bottom">
            <div className="observation-destinations" aria-label="Journey destinations">
              <button type="button" className="observation-exit-btn" onClick={() => visit(flightState.sectorIndex - 1)} disabled={telemetry.sector <= 1} aria-label="Previous destination">←</button>
              <label>
                <span className="observation-tag">EXPLORE</span>
                <select aria-label="Solar System destination" value={telemetry.sector <= 10 ? telemetry.sector - 1 : 'beyond'} onChange={(event) => visit(event.target.value === 'beyond' ? 10 : Number(event.target.value))}>
                  {SOLAR_DESTINATIONS.map((name, index) => <option key={name} value={index}>{name}</option>)}
                  <option value="beyond">Beyond the Solar System</option>
                </select>
              </label>
              <button type="button" className="observation-exit-btn" onClick={() => visit(flightState.sectorIndex + 1)} aria-label="Next destination">→</button>
            </div>
            {telemetry.sector === 1 && <label className="observation-solar-view">
              <span className="observation-tag">SUN VIEW</span>
              <select aria-label="Solar viewing filter" value={solarView} title="NASA/SDO 304 Å historical observations with simulated 3D plasma. Instrument false colour; not a live or naked-eye view." onChange={(event) => {
                const next = event.target.value as typeof solarView;
                flightState.solarView = next;
                setSolarView(next);
              }}>
                <option value="euv">SDO 304 Å · composite</option>
                <option value="white-light">White light</option>
              </select>
            </label>}
            <div className="observation-zoom">
            <button type="button" className="observation-exit-btn" aria-pressed={closeView} onClick={() => {
              const next = !closeView;
              flightState.viewMagnification = next ? telemetry.sector === 1 ? solarView === 'euv' ? 4.5 : 12 : telemetry.sector === 2 ? 2.5 : 1.8 : 1;
              flightState.inspectSunspots = next && telemetry.sector === 1;
              if (flightState.inspectSunspots) flightState.autoDrift = false;
              setMagnification(flightState.viewMagnification);
              setCloseView(next);
            }}>{closeView ? 'WIDE VIEW' : telemetry.sector === 1 ? solarView === 'euv' ? 'INSPECT PLASMA' : 'INSPECT SUNSPOTS' : 'CLOSER VIEW'}</button>
            <label>
              <span className="observation-tag">{magnification.toFixed(1)}×</span>
              <input type="range" min="1" max="16" step="0.1" value={magnification} aria-label="Magnification" onChange={(event) => {
                const value = Number(event.target.value);
                flightState.viewMagnification = value;
                if (value === 1) flightState.inspectSunspots = false;
                setMagnification(value);
                setCloseView(value > 1);
              }} />
            </label>
            </div>
            <div className="observation-hint-pill">
              <span className="observation-hint-item">Scroll or swipe to travel</span>
              <span className="observation-hint-item">Arrow keys to cruise</span>
              <span className="observation-hint-item">Drag to look around</span>
              <span className="observation-hint-item">Time accelerated · distances compressed</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
