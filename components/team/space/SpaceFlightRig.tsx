'use client';

/**
 * SpaceFlightRig — Cinema-grade 3D flight camera through vast deep space.
 *
 * The camera follows a closed Catmull-Rom spline through 7 distant celestial
 * sectors spanning ~15,600 units of 3D space. Each body is placed extremely far
 * from others so only one is prominent at any time.
 *
 * Normal scroll mode covers the first ~30% of the spline (Earth → Mars → Asteroids).
 * Observation mode enables infinite cruise through the entire cosmos.
 *
 * The return arc (last ~15% of spline) sends the camera far above the main plane
 * at y=2000, looping back to the start with a cinematic deep-cosmos feel.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { flightState } from './spaceFlightState';

/**
 * How much of the spline a full page scroll covers.
 * 0.30 means scrolling from top to bottom of the page advances through
 * sectors 0-2 (Earth, Mars, start of Asteroid belt).
 */
const PAGE_JOURNEY_FRACTION = 0.30;

/**
 * Minimum scroll-equivalent in pixels. Prevents short pages (like /team/core
 * with ~800px) from rushing through space. The camera moves as if the page
 * were at least this many pixels tall.
 */
const MIN_SCROLL_TRAVEL = 2000;

/**
 * Major celestial body world-space positions for dwell slowdown.
 * Camera automatically decelerates when approaching these, lingering
 * to present the body in full view before drifting onward.
 * Debris (asteroids) excluded — only planets and black holes trigger dwell.
 */
const BODY_POSITIONS: [number, number, number][] = [
  [120, 50, -1200],     // Earth
  [-150, -30, -3600],   // Mars
  [-120, -60, -8400],   // Jupiter
  [80, 20, -10800],     // Black Hole
  [-100, 70, -13200],   // Saturn
  [140, -50, -15600],   // Neptune
];
/** Distance (units) at which the camera begins slowing down. */
const DWELL_APPROACH_DIST = 300;
/** Speed fraction at closest approach (0.12 = 12% of normal speed, ~8× slower). */
const DWELL_MIN_SPEED = 0.12;

function computeDwellFactor(camPos: THREE.Vector3): number {
  let factor = 1.0;
  for (const bp of BODY_POSITIONS) {
    const dx = camPos.x - bp[0];
    const dy = camPos.y - bp[1];
    const dz = camPos.z - bp[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < DWELL_APPROACH_DIST) {
      const t = dist / DWELL_APPROACH_DIST;
      const speed = DWELL_MIN_SPEED + (1.0 - DWELL_MIN_SPEED) * t * t;
      factor = Math.min(factor, speed);
    }
  }
  return factor;
}

export function SpaceFlightRig() {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  const targetProgress = useRef(0);
  const currentProgress = useRef(0);
  const targetNdc = useRef(new THREE.Vector2());
  const currentNdc = useRef(new THREE.Vector2());

  // Interactive freelook for Observation Mode
  const isDragging = useRef(false);
  const prevPointer = useRef({ x: 0, y: 0 });
  const freelookYaw = useRef(0);
  const freelookPitch = useRef(0);
  const targetYaw = useRef(0);
  const targetPitch = useRef(0);
  const lastInteractionTime = useRef(performance.now());

  /**
   * Closed Catmull-Rom spline for camera position — 18 waypoints.
   *
   * Waypoints 0-14: Outbound journey through 7 celestial sectors.
   *   Each body gets a "flyby" waypoint near it, with void-transit waypoints between.
   * Waypoints 15-17: Return arc at y=2000+ (far above all bodies), looping back to start.
   *
   * Body positions:
   *   Earth [120,50,-1200], Mars [-150,-30,-3600], Asteroids [30,80,-6000],
   *   Jupiter [-120,-60,-8400], BlackHole [80,20,-10800],
   *   Saturn [-100,70,-13200], Neptune [140,-50,-15600]
   */
  const posCurve = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 50),            // 0  Start: pure dark cosmos
      new THREE.Vector3(30, 50, -600),         // 1  Approaching Earth zone
      new THREE.Vector3(30, 100, -1180),       // 2  Earth flyby (~104u from body)
      new THREE.Vector3(-30, -5, -2400),       // 3  Void transit → Mars
      new THREE.Vector3(-60, 30, -3580),       // 4  Mars flyby (~105u from body)
      new THREE.Vector3(-50, 35, -4800),       // 5  Void transit → asteroids
      new THREE.Vector3(25, 75, -5960),        // 6  Asteroid field encounter
      new THREE.Vector3(-45, -10, -7200),      // 7  Void transit → Jupiter
      new THREE.Vector3(-20, -20, -8380),      // 8  Jupiter flyby (~108u from body)
      new THREE.Vector3(-10, -5, -9600),       // 9  Void transit → black hole
      new THREE.Vector3(-10, 70, -10780),      // 10 Black hole flyby (~103u from body)
      new THREE.Vector3(-20, 48, -12000),      // 11 Void transit → Saturn
      new THREE.Vector3(0, 130, -13180),       // 12 Saturn flyby (~114u from body)
      new THREE.Vector3(30, -10, -14400),      // 13 Void transit → Neptune
      new THREE.Vector3(40, 10, -15580),       // 14 Neptune flyby (~114u from body)
      // Return arc: camera climbs far above the main plane
      new THREE.Vector3(80, 2000, -10000),     // 15 High above everything
      new THREE.Vector3(-30, 1200, -3000),     // 16 Descending toward start
      new THREE.Vector3(-10, 300, -200),       // 17 Approaching origin
    ]);
    curve.closed = true;
    return curve;
  }, []);

  /**
   * Look-at target spline — tracks nearby celestial bodies during flybys,
   * looks forward into deep space during void transits.
   */
  const lookCurve = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -300),           // 0  Gazing into cosmos
      new THREE.Vector3(120, 50, -1200),       // 1  Tracking Earth
      new THREE.Vector3(120, 50, -1200),       // 2  Tracking Earth
      new THREE.Vector3(-80, -15, -3200),      // 3  Toward Mars
      new THREE.Vector3(-150, -30, -3600),     // 4  Tracking Mars
      new THREE.Vector3(0, 40, -5600),         // 5  Forward into void
      new THREE.Vector3(30, 80, -6000),        // 6  Tracking asteroid field
      new THREE.Vector3(-60, -30, -8000),      // 7  Toward Jupiter
      new THREE.Vector3(-120, -60, -8400),     // 8  Tracking Jupiter
      new THREE.Vector3(40, 10, -10400),       // 9  Toward black hole
      new THREE.Vector3(80, 20, -10800),       // 10 Tracking black hole
      new THREE.Vector3(-50, 50, -12800),      // 11 Toward Saturn
      new THREE.Vector3(-100, 70, -13200),     // 12 Tracking Saturn
      new THREE.Vector3(70, -25, -15200),      // 13 Toward Neptune
      new THREE.Vector3(140, -50, -15600),     // 14 Tracking Neptune
      // Return arc: looking across the vast cosmos below
      new THREE.Vector3(40, 400, -12000),      // 15 Panoramic cosmos view
      new THREE.Vector3(0, 200, -5000),        // 16 Looking toward origin
      new THREE.Vector3(0, 50, -500),          // 17 Approaching start
    ]);
    curve.closed = true;
    return curve;
  }, []);

  const scratchPos = useRef(new THREE.Vector3());
  const scratchLook = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleScroll = () => {
      if (flightState.observationMode) return;
      const doc = document.documentElement;
      const rawMaxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      // Enforce minimum scroll travel so short pages feel slow and cinematic
      const effectiveMax = Math.max(MIN_SCROLL_TRAVEL, rawMaxScroll);
      // Page scroll covers only a fraction of the total spline journey
      const progress = (window.scrollY / effectiveMax) * PAGE_JOURNEY_FRACTION;
      targetProgress.current = progress;
      lastInteractionTime.current = performance.now();
      invalidate();
    };

    const handleWheel = (e: WheelEvent) => {
      if (!flightState.observationMode) return;
      // Gentle thrusters for infinite cruise in observation mode
      const delta = e.deltaY * 0.00006;
      targetProgress.current += delta;
      lastInteractionTime.current = performance.now();
      invalidate();
    };

    const handlePointerMove = (e: PointerEvent) => {
      targetNdc.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );

      if (flightState.observationMode && isDragging.current) {
        const dx = e.clientX - prevPointer.current.x;
        const dy = e.clientY - prevPointer.current.y;
        prevPointer.current = { x: e.clientX, y: e.clientY };

        targetYaw.current -= dx * 0.003;
        targetPitch.current = THREE.MathUtils.clamp(
          targetPitch.current - dy * 0.003,
          -Math.PI * 0.4,
          Math.PI * 0.4,
        );
        lastInteractionTime.current = performance.now();
      }
      invalidate();
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!flightState.observationMode) return;
      isDragging.current = true;
      prevPointer.current = { x: e.clientX, y: e.clientY };
      lastInteractionTime.current = performance.now();
    };

    const handlePointerUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [invalidate]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const now = performance.now();

    // Auto-cruise gentle drift when idle in Observation Mode
    if (flightState.observationMode && flightState.autoDrift) {
      if (now - lastInteractionTime.current > 2000) {
        targetProgress.current += delta * 0.004;
      }
    }

    // Preview position on spline for dwell computation
    const previewU = ((currentProgress.current % 1.0) + 1.0) % 1.0;
    posCurve.getPoint(previewU, scratchPos.current);
    const dwellFactor = computeDwellFactor(scratchPos.current);

    // Heavy aerospace inertia with body-proximity dwell slowdown
    // Near a major body: camera lingers at ~12% speed to show full view
    // In open void: full speed cinematic cruise
    currentProgress.current +=
      (targetProgress.current - currentProgress.current) *
      Math.min(1, delta * 0.8 * dwellFactor);
    const rawP = currentProgress.current;

    // Seamless cyclic modulo for closed Catmull-Rom spline
    const u = ((rawP % 1.0) + 1.0) % 1.0;
    flightState.progress = u;

    // Smooth mouse parallax & freelook
    currentNdc.current.lerp(targetNdc.current, Math.min(1, delta * 3.0));
    freelookYaw.current = THREE.MathUtils.lerp(
      freelookYaw.current,
      targetYaw.current,
      Math.min(1, delta * 4.0),
    );
    freelookPitch.current = THREE.MathUtils.lerp(
      freelookPitch.current,
      targetPitch.current,
      Math.min(1, delta * 4.0),
    );

    // Sample camera position and look-at from splines
    posCurve.getPoint(u, scratchPos.current);
    lookCurve.getPoint(u, scratchLook.current);

    // Natural zero-gravity breathing sway
    const time = now * 0.0004;
    const swayX = Math.sin(time) * 0.3;
    const swayY = Math.cos(time * 0.7) * 0.2;

    // Mouse parallax offset
    const mouseX = currentNdc.current.x * 1.5;
    const mouseY = currentNdc.current.y * 1.0;

    camera.position.set(
      scratchPos.current.x + swayX + mouseX,
      scratchPos.current.y + swayY + mouseY,
      scratchPos.current.z,
    );

    // Look direction with optional freelook in Observation Mode
    const lookDir = new THREE.Vector3()
      .subVectors(scratchLook.current, scratchPos.current)
      .normalize();

    if (
      flightState.observationMode &&
      (Math.abs(freelookYaw.current) > 0.001 ||
        Math.abs(freelookPitch.current) > 0.001)
    ) {
      lookDir.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        freelookYaw.current,
      );
      const right = new THREE.Vector3()
        .crossVectors(lookDir, new THREE.Vector3(0, 1, 0))
        .normalize();
      lookDir.applyAxisAngle(right, freelookPitch.current);
    }

    const finalLook = new THREE.Vector3().addVectors(
      camera.position,
      lookDir.multiplyScalar(100),
    );
    camera.lookAt(finalLook);

    // Subtle banking roll into turns
    camera.rotation.z = -currentNdc.current.x * 0.015;
  });

  return null;
}
