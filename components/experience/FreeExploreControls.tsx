'use client';

import { OrbitControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MOUSE, TOUCH } from 'three';
import { phases } from '@/lib/scrollTimeline';

const PAN_RADIUS = 3.6;
const MIN_DISTANCE = 1.65;
const MAX_DISTANCE = 16;
const WHEEL_BOUNDARY_EPSILON = 0.025;
type TouchAction = (typeof TOUCH)[keyof typeof TOUCH];
// OrbitControls has no public `TOUCH.NONE` value. Its default switch branch
// keeps one-finger touch in the neutral state while still tracking that first
// pointer, so a second finger can start the configured pinch/pan gesture.
const PAGE_SCROLL_TOUCH = -1 as TouchAction;

/**
 * Enables drei <OrbitControls> only after the last scroll phase.
 * Before that, the ScrollDirector owns the camera. After the user
 * reaches the unlock phase, the OrbitControls handle pan/zoom/rotate.
 */
export function FreeExploreControls({
  progressRef,
}: {
  progressRef: React.RefObject<number>;
}) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { gl } = useThree();

  useFrame(() => {
    if (!ref.current) return;
    const active = (progressRef.current ?? 0) >= phases[phases.length - 1].start;
    ref.current.enabled = active;
    if (active) {
      const target = ref.current.target;
      const radial = Math.hypot(target.x, target.z);
      if (radial > PAN_RADIUS) {
        const scale = PAN_RADIUS / radial;
        target.x *= scale;
        target.z *= scale;
      }
      target.y = Math.min(1.65, Math.max(0.28, target.y));
    }
  });

  useEffect(() => {
    const controls = ref.current;
    if (!controls) return undefined;

    // Input ownership is selected per event rather than from screen size:
    // one-finger touch stays native page navigation, while two fingers are
    // reserved for the model's pinch/pan gesture.
    controls.enabled = false;
    const canvas = gl.domElement;
    const controlElement = controls.domElement ?? canvas;
    const touchActionElements = Array.from(new Set([canvas, controlElement]));
    const previousTouchActions = touchActionElements.map((element) => element.style.touchAction);
    touchActionElements.forEach((element) => {
      element.style.touchAction = 'pan-x pan-y';
    });
    let disposed = false;
    let restoreTimer = 0;

    const handOffBoundaryWheel = (event: WheelEvent) => {
      const active = (progressRef.current ?? 0) >= phases[phases.length - 1].start;
      if (!active || event.deltaY === 0) return;

      const distance = controls.getDistance();
      const atMinimum = distance <= MIN_DISTANCE + WHEEL_BOUNDARY_EPSILON;
      const atMaximum = distance >= MAX_DISTANCE - WHEEL_BOUNDARY_EPSILON;
      const shouldScrollPage = (event.deltaY < 0 && atMinimum)
        || (event.deltaY > 0 && atMaximum);
      if (!shouldScrollPage) return;

      // This capture listener runs before OrbitControls' wheel listener. Keep
      // the controls disabled only for this event so it is not cancelled and
      // Lenis/the browser can move the document in the same direction.
      controls.enabled = false;
      window.clearTimeout(restoreTimer);
      restoreTimer = window.setTimeout(() => {
        if (!disposed) {
          controls.enabled = (progressRef.current ?? 0) >= phases[phases.length - 1].start;
        }
      }, 0);
    };

    controlElement.addEventListener('wheel', handOffBoundaryWheel, { capture: true, passive: true });
    return () => {
      disposed = true;
      window.clearTimeout(restoreTimer);
      controlElement.removeEventListener('wheel', handOffBoundaryWheel, { capture: true });
      touchActionElements.forEach((element, index) => {
        if (element.style.touchAction === 'pan-x pan-y') {
          element.style.touchAction = previousTouchActions[index];
        }
      });
    };
  }, [gl, progressRef]);

  return (
    <OrbitControls
      ref={ref}
      enableDamping
      dampingFactor={0.075}
      enablePan
      enableRotate
      enableZoom
      screenSpacePanning
      panSpeed={0.82}
      rotateSpeed={0.72}
      zoomSpeed={0.92}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={0.48}
      maxPolarAngle={Math.PI * 0.48}
      target={[0, 0.82, 0]}
      mouseButtons={{
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      }}
      touches={{
        ONE: PAGE_SCROLL_TOUCH,
        TWO: TOUCH.DOLLY_PAN,
      }}
      makeDefault
    />
  );
}
