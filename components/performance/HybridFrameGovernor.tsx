'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

const ACTIVE_FRAME_INTERVAL_MS = 1_000 / 60;
const MODERATE_FRAME_INTERVAL_MS = 1_000 / 40;
const GENTLE_FRAME_INTERVAL_MS = 1_000 / 30;
const IDLE_FRAME_INTERVAL_MS = 1_000 / 30;
const OVERLOAD_FRAME_INTERVAL_MS = 1_000 / 24;
const REDUCED_ACTIVE_FRAME_INTERVAL_MS = 1_000 / 24;
const REDUCED_MOTION_FRAME_INTERVAL_MS = 1_000 / 4;
const ENERGY_DECAY_MS = 440;
const DEFAULT_STARTUP_DURATION_MS = 1_200;

type HybridFrameGovernorProps = {
  forceActive?: boolean;
  reduceMotion?: boolean;
  startupDurationMs?: number;
  suspended?: boolean;
};

/**
 * Match WebGL cost to how much the picture is changing. A lightweight RAF
 * scheduler selects 4/24/30/40/60 FPS from real pointer velocity, wheel force,
 * dragging, scrolling, and forced animation, then decays back to idle.
 */
export function HybridFrameGovernor({
  forceActive = false,
  reduceMotion = false,
  startupDurationMs = DEFAULT_STARTUP_DURATION_MS,
  suspended = false,
}: HybridFrameGovernorProps) {
  const invalidate = useThree((state) => state.invalidate);
  const forceActiveRef = useRef(forceActive);

  useEffect(() => {
    forceActiveRef.current = forceActive;
  }, [forceActive]);

  useEffect(() => {
    if (suspended) return undefined;

    let disposed = false;
    let frame = 0;
    let lastInvalidation = Number.NEGATIVE_INFINITY;
    let lastSampleTime = performance.now();
    const startupUntil = lastSampleTime + startupDurationMs;
    let energy = 1;
    let pointerDistance = 0;
    let wheelImpulse = 0;
    let overload = 0;
    let foreground = true;
    let lastPointerX: number | undefined;
    let lastPointerY: number | undefined;

    const addEnergy = (amount: number) => {
      energy = Math.max(energy, Math.min(1, amount));
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (lastPointerX !== undefined && lastPointerY !== undefined) {
        pointerDistance += Math.hypot(
          event.clientX - lastPointerX,
          event.clientY - lastPointerY,
        );
      }
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      if (event.buttons !== 0) addEnergy(0.9);
    };

    const handleWheel = (event: WheelEvent) => {
      wheelImpulse = Math.max(
        wheelImpulse,
        Math.min(1, (Math.abs(event.deltaX) + Math.abs(event.deltaY)) / 1_000),
      );
    };
    const handlePointerDown = () => addEnergy(1);
    const handlePointerUp = () => addEnergy(0.38);
    const handleTouchMove = () => addEnergy(0.55);
    // Scrolling changes both the DOM overlay and the WebGL camera. Keep those
    // layers on the same display-rate cadence until Lenis finishes its easing
    // tail; throttling only the canvas produces a visible old/new-frame flash.
    const handleScroll = () => addEnergy(1);
    const handleKeyDown = () => addEnergy(0.35);
    const handleFocus = () => {
      foreground = true;
      lastInvalidation = Number.NEGATIVE_INFINITY;
      lastSampleTime = performance.now();
      addEnergy(0.18);
    };
    const resetPointerSample = () => {
      lastPointerX = undefined;
      lastPointerY = undefined;
      pointerDistance = 0;
    };
    const handleBlur = () => {
      foreground = false;
      resetPointerSample();
    };

    const schedule = (now: number) => {
      if (disposed) return;
      if (!document.hidden && foreground) {
        const sampleDuration = Math.min(100, Math.max(1, now - lastSampleTime));
        lastSampleTime = now;
        energy *= Math.exp(-sampleDuration / ENERGY_DECAY_MS);

        // A slow device must not accumulate WebGL/GPU work while trying to
        // reach a tier it physically cannot sustain. Long rAF gaps raise a
        // short-lived pressure score which caps only the expensive tiers; it
        // recovers automatically as soon as the main thread catches up.
        if (sampleDuration >= 50) overload = Math.min(1, overload + 0.34);
        else if (sampleDuration >= 28) overload = Math.min(1, overload + 0.12);
        else overload = Math.max(0, overload - 0.025);

        const pointerSpeed = pointerDistance / (sampleDuration / 1_000);
        pointerDistance = 0;
        const pointerEnergy = Math.min(1, Math.max(0, (pointerSpeed - 40) / 1_200));
        energy = Math.max(energy, pointerEnergy, wheelImpulse);
        wheelImpulse = 0;

        if (forceActiveRef.current || now < startupUntil) energy = 1;
        let interval = reduceMotion
          ? energy >= 0.28
            ? REDUCED_ACTIVE_FRAME_INTERVAL_MS
            : REDUCED_MOTION_FRAME_INTERVAL_MS
          : energy >= 0.72
            ? ACTIVE_FRAME_INTERVAL_MS
            : energy >= 0.28
              ? MODERATE_FRAME_INTERVAL_MS
              : energy >= 0.06
                ? GENTLE_FRAME_INTERVAL_MS
                : IDLE_FRAME_INTERVAL_MS;
        if (!reduceMotion) {
          if (overload >= 0.65) interval = Math.max(interval, OVERLOAD_FRAME_INTERVAL_MS);
          else if (overload >= 0.25) interval = Math.max(interval, MODERATE_FRAME_INTERVAL_MS);
        }
        const elapsed = now - lastInvalidation;
        if (elapsed >= interval - 0.5) {
          lastInvalidation = Number.isFinite(lastInvalidation)
            ? now - (elapsed % interval)
            : now;
          invalidate();
        }
      }
      frame = window.requestAnimationFrame(schedule);
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        lastInvalidation = Number.NEGATIVE_INFINITY;
        lastSampleTime = performance.now();
        addEnergy(0.18);
      }
    };

    const passive = { passive: true } as const;
    window.addEventListener('pointerdown', handlePointerDown, passive);
    window.addEventListener('pointermove', handlePointerMove, passive);
    window.addEventListener('pointerup', handlePointerUp, passive);
    window.addEventListener('touchmove', handleTouchMove, passive);
    window.addEventListener('wheel', handleWheel, passive);
    window.addEventListener('scroll', handleScroll, passive);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.documentElement.addEventListener('pointerleave', resetPointerSample);
    document.addEventListener('visibilitychange', handleVisibility);
    frame = window.requestAnimationFrame(schedule);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.documentElement.removeEventListener('pointerleave', resetPointerSample);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [invalidate, reduceMotion, startupDurationMs, suspended]);

  return null;
}

/** Eagerly retire a route canvas instead of waiting for R3F's delayed teardown. */
export function WebGLRendererLifecycle() {
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => () => {
    gl.setAnimationLoop(null);
    gl.domElement.remove();

    // Layout cleanup runs before descendants' passive texture/material
    // cleanup. Retire the canvas immediately, then release the renderer on
    // the next task so owned resources can dispose in the correct order.
    const forceContextLoss = gl.forceContextLoss.bind(gl);
    gl.forceContextLoss = () => {
      if (!gl.getContext().isContextLost()) forceContextLoss();
    };
    window.setTimeout(() => {
      gl.renderLists.dispose();
      gl.dispose();
      gl.forceContextLoss();
    }, 0);
  }, [gl]);

  return null;
}
