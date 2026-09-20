'use client';

/**
 * CinematicObservationHUD — Aerospace telemetry HUD and toggle for Universe Observation Mode.
 *
 * Allows users to turn off all page contents (cards, text, scrims, navbar) with a single click or
 * keypress ('O', 'Space', 'Esc'), revealing the unobstructed 3D universe in full screen with:
 *  - Infinite scroll cruise navigation.
 *  - Interactive 360° mouse freelook.
 *  - Auto-cruise gentle zero-g drift.
 *  - Real-time astronomical telemetry HUD (current target sector, flight status).
 */

import { useCallback, useEffect, useState } from 'react';
import { flightState } from './spaceFlightState';

export function CinematicObservationHUD() {
  const [active, setActive] = useState(false);
  const [sectorName, setSectorName] = useState('MARS ORBITAL APPROACH');
  const [autoDrift, setAutoDrift] = useState(true);

  const toggleMode = useCallback(() => {
    setActive((prev) => {
      const next = !prev;
      flightState.observationMode = next;
      if (next) {
        document.body.classList.add('observation-mode-active');
      } else {
        document.body.classList.remove('observation-mode-active');
      }
      return next;
    });
  }, []);

  const exitMode = useCallback(() => {
    setActive(false);
    flightState.observationMode = false;
    document.body.classList.remove('observation-mode-active');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with 'O' or 'o'
      if (e.key === 'o' || e.key === 'O') {
        const el = e.target as HTMLElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        toggleMode();
      } else if (e.key === 'Escape' && flightState.observationMode) {
        exitMode();
      } else if (e.key === ' ' && flightState.observationMode) {
        e.preventDefault();
        flightState.autoDrift = !flightState.autoDrift;
        setAutoDrift(flightState.autoDrift);
      }
    };

    const interval = setInterval(() => {
      if (flightState.activeSectorName !== sectorName) {
        setSectorName(flightState.activeSectorName);
      }
    }, 150);

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
    };
  }, [sectorName, toggleMode, exitMode]);

  return (
    <>
      {/* Floating Trigger Button in Default Page View */}
      {!active && (
        <button
          type="button"
          className="observation-launch-trigger"
          onClick={toggleMode}
          title="Turn off page contents and observe the universe in full screen (Shortcut: 'O')"
          aria-label="Observe Universe in Full Screen"
        >
          <span className="pulse-dot" />
          <span>OBSERVE UNIVERSE</span>
          <span className="observation-hint-key" style={{ fontSize: '0.65rem' }}>O</span>
        </button>
      )}

      {/* Observation Mode HUD Overlay */}
      {active && (
        <div className="observation-hud" aria-live="polite">
          {/* Top Bar: Telemetry & Exit */}
          <div className="observation-hud-top">
            <div className="observation-telemetry">
              <div className="observation-tag">
                <span className="pulse-dot" />
                <span>SYS_VOYAGE // DEEP SPACE OBSERVATORY</span>
              </div>
              <div className="observation-target">{sectorName}</div>
              <div className="observation-tag" style={{ marginTop: '2px' }}>
                <span>PROPULSION: {autoDrift ? 'AUTO-CRUISE [ACTIVE]' : 'MANUAL THRUST'}</span>
              </div>
            </div>

            <button
              type="button"
              className="observation-exit-btn"
              onClick={exitMode}
              title="Return to Deck (Shortcut: ESC)"
            >
              <span>RETURN TO DECK</span>
              <span className="observation-hint-key">ESC</span>
            </button>
          </div>

          {/* Bottom Bar: Control Hints */}
          <div className="observation-hud-bottom">
            <div className="observation-hint-pill">
              <span className="observation-hint-item">
                <span className="observation-hint-key">SCROLL</span>
                <span>CRUISE INFINITELY</span>
              </span>
              <span className="observation-hint-item">
                <span className="observation-hint-key">DRAG</span>
                <span>360° LOOK</span>
              </span>
              <span className="observation-hint-item">
                <span className="observation-hint-key">SPACE</span>
                <span>TOGGLE DRIFT</span>
              </span>
              <span className="observation-hint-item">
                <span className="observation-hint-key">ESC</span>
                <span>EXIT</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
