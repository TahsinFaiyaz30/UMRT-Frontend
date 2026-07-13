'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

const ACTIVE_FRAME_INTERVAL_MS = 1_000 / 60;
const MODERATE_FRAME_INTERVAL_MS = 1_000 / 40;
const GENTLE_FRAME_INTERVAL_MS = 1_000 / 24;
const IDLE_FRAME_INTERVAL_MS = 1_000 / 10;
const REDUCED_MOTION_FRAME_INTERVAL_MS = 1_000 / 4;
const ENERGY_DECAY_MS = 700;

type HybridFrameGovernorProps = {
  forceActive?: boolean;
  reduceMotion?: boolean;
  startupDurationMs?: number;
  suspended?: boolean;
};

/**
 * Match WebGL cost to how much the picture is changing. A lightweight RAF
 * scheduler selects 10/24/40/60 FPS from real pointer velocity, wheel force,
 * dragging, scrolling, and forced animation, then decays back to idle.
 */
export function HybridFrameGovernor({
  forceActive = false,
  reduceMotion = false,
  startupDurationMs = 5_000,
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
        Math.min(1, (Math.abs(event.deltaX) + Math.abs(event.deltaY)) / 300),
      );
    };
    const handlePointerDown = () => addEnergy(1);
    const handlePointerUp = () => addEnergy(0.72);
    const handleTouchMove = () => addEnergy(0.9);
    const handleScroll = () => addEnergy(0.45);
    const handleKeyDown = () => addEnergy(0.5);
    const handleFocus = () => addEnergy(0.45);
    const resetPointerSample = () => {
      lastPointerX = undefined;
      lastPointerY = undefined;
      pointerDistance = 0;
    };

    const schedule = (now: number) => {
      if (disposed) return;
      if (!document.hidden) {
        const sampleDuration = Math.min(100, Math.max(1, now - lastSampleTime));
        lastSampleTime = now;
        energy *= Math.exp(-sampleDuration / ENERGY_DECAY_MS);

        const pointerSpeed = pointerDistance / (sampleDuration / 1_000);
        pointerDistance = 0;
        const pointerEnergy = Math.min(1, Math.max(0, (pointerSpeed - 40) / 1_200));
        energy = Math.max(energy, pointerEnergy, wheelImpulse);
        wheelImpulse = 0;

        if (forceActiveRef.current || now < startupUntil) energy = 1;
        const interval = reduceMotion
          ? energy >= 0.28
            ? GENTLE_FRAME_INTERVAL_MS
            : REDUCED_MOTION_FRAME_INTERVAL_MS
          : energy >= 0.72
            ? ACTIVE_FRAME_INTERVAL_MS
            : energy >= 0.28
              ? MODERATE_FRAME_INTERVAL_MS
              : energy >= 0.06
                ? GENTLE_FRAME_INTERVAL_MS
                : IDLE_FRAME_INTERVAL_MS;
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
        addEnergy(0.72);
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
    window.addEventListener('blur', resetPointerSample);
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
      window.removeEventListener('blur', resetPointerSample);
      document.documentElement.removeEventListener('pointerleave', resetPointerSample);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [invalidate, reduceMotion, startupDurationMs, suspended]);

  return null;
}

/** Detach a retired canvas before React removes its route subtree. */
export function WebGLRendererLifecycle() {
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => () => {
    gl.setAnimationLoop(null);
    gl.domElement.remove();
  }, [gl]);

  return null;
}
