'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createEncounter } from './encounterCatalog';
import { encounterWorldDistance, travelWorldDistance } from './encounterPresentation';
import { cameraTravelDistance, flightState, isFlightControlTarget, sampleFlightPose } from './spaceFlightState';
import { ENCOUNTER_OFFSET, SCROLL_WORLD_SCALE, SECTOR_LENGTH } from './spaceTypes';

const MAX_SPEED = 420;
const MAX_INPUT_LEAD = 680;
const AUTO_DRIFT_SPEED = 68;

export function SpaceFlightRig() {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const pathname = usePathname();
  const pageDistance = useRef(0);
  const observationTarget = useRef(0);
  const previousMode = useRef(false);
  const lastInteraction = useRef(0);
  const pointerTarget = useRef(new THREE.Vector2());
  const pointer = useRef(new THREE.Vector2());
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const lookTarget = useRef(new THREE.Vector2());
  const look = useRef(new THREE.Vector2());
  const pose = useRef({ x: 0, y: 0, yaw: 0, pitch: 0 });
  const lookAt = useRef(new THREE.Vector3());
  const encounter = useRef(createEncounter(0));
  const inspectedRegion = useRef(-1);
  const regionDirection = useRef(new THREE.Vector3());
  const viewDirection = useRef(new THREE.Vector3());
  const sunView = useRef(new THREE.Vector3());
  const mercuryView = useRef(new THREE.Vector3());
  const openingBodies = useRef([createEncounter(0), createEncounter(1)]);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = Math.max(1, size.width) / Math.max(1, size.height);
    // Keep a 45-degree view across the shorter dimension, including portrait.
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(Math.PI / 8) / Math.min(1, aspect)),
    );
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);

  useEffect(() => {
    const distance = Math.max(0, window.scrollY) * SCROLL_WORLD_SCALE;
    pageDistance.current = distance;
    observationTarget.current = distance;
    flightState.distance = distance;
    flightState.targetDistance = distance;
    flightState.sectorIndex = Math.floor(distance / SECTOR_LENGTH);
    flightState.origin = flightState.sectorIndex * SECTOR_LENGTH;
    // The HUD owns route exits; preserve Observe if it was selected while
    // this scene's lazy bundle was loading.
    previousMode.current = false;
    drag.current = null;
    touch.current = null;
    pointer.current.set(0, 0);
    pointerTarget.current.set(0, 0);
    look.current.set(0, 0);
    lookTarget.current.set(0, 0);
  }, [pathname]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      flightState.reducedMotion = reduced.matches;
      if (reduced.matches) flightState.autoDrift = false;
    };
    updateMotion();
    reduced.addEventListener('change', updateMotion);

    const navigate = (delta: number) => {
      flightState.inspectSunspots = false;
      observationTarget.current = THREE.MathUtils.clamp(
        observationTarget.current + delta,
        Math.max(0, flightState.distance - MAX_INPUT_LEAD),
        flightState.distance + MAX_INPUT_LEAD,
      );
      lastInteraction.current = performance.now();
    };
    const handleScroll = () => {
      if (!flightState.observationMode) pageDistance.current = Math.max(0, window.scrollY) * SCROLL_WORLD_SCALE;
    };
    const handleWheel = (event: WheelEvent) => {
      if (!flightState.observationMode || event.ctrlKey || isFlightControlTarget(event.target)) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      navigate(THREE.MathUtils.clamp(pixels * SCROLL_WORLD_SCALE, -280, 280));
    };
    const handleKey = (event: KeyboardEvent) => {
      if (!flightState.observationMode || isFlightControlTarget(event.target)
        || event.altKey || event.metaKey || event.ctrlKey) return;
      const amount = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 110
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -110
          : event.key === 'PageDown' ? 520 : event.key === 'PageUp' ? -520 : 0;
      if (amount) {
        event.preventDefault();
        navigate(amount);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!flightState.observationMode || event.pointerType === 'touch' || event.button !== 0
        || isFlightControlTarget(event.target)) return;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      flightState.inspectSunspots = false;
      lastInteraction.current = performance.now();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointerTarget.current.set(event.clientX / window.innerWidth * 2 - 1, 1 - event.clientY / window.innerHeight * 2);
      if (flightState.observationMode && drag.current?.id === event.pointerId) {
        lookTarget.current.x -= (event.clientX - drag.current.x) * 0.003;
        lookTarget.current.y = THREE.MathUtils.clamp(
          lookTarget.current.y + (event.clientY - drag.current.y) * 0.003, -1.05, 1.05,
        );
        drag.current.x = event.clientX;
        drag.current.y = event.clientY;
        lastInteraction.current = performance.now();
      }
    };
    const releasePointer = () => { drag.current = null; };
    const handleTouchStart = (event: TouchEvent) => {
      if (!flightState.observationMode || isFlightControlTarget(event.target) || event.touches.length !== 1) {
        touch.current = null;
        return;
      }
      touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      lastInteraction.current = performance.now();
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!flightState.observationMode || !touch.current || event.touches.length !== 1) return;
      event.preventDefault();
      const current = event.touches[0];
      navigate((touch.current.y - current.clientY) * 1.9);
      touch.current = { x: current.clientX, y: current.clientY };
    };
    const releaseTouch = () => { touch.current = null; };
    const releaseAll = () => {
      releasePointer();
      releaseTouch();
      pointerTarget.current.set(0, 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    window.addEventListener('pageshow', handleScroll);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKey);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', releaseTouch);
    window.addEventListener('touchcancel', releaseTouch);
    window.addEventListener('blur', releaseAll);
    return () => {
      reduced.removeEventListener('change', updateMotion);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('pageshow', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', releasePointer);
      window.removeEventListener('pointercancel', releasePointer);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', releaseTouch);
      window.removeEventListener('touchcancel', releaseTouch);
      window.removeEventListener('blur', releaseAll);
    };
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const observing = flightState.observationMode;
    if (camera instanceof THREE.PerspectiveCamera) {
      const zoom = observing ? flightState.viewMagnification : 1;
      if (Math.abs(camera.zoom - zoom) > 0.0001) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
      }
    }
    if (observing !== previousMode.current) {
      previousMode.current = observing;
      observationTarget.current = flightState.distance;
      lastInteraction.current = performance.now();
      drag.current = null;
      touch.current = null;
      if (!observing) {
        pageDistance.current = Math.max(0, window.scrollY) * SCROLL_WORLD_SCALE;
        flightState.distance = pageDistance.current;
        lookTarget.current.set(0, 0);
        look.current.set(0, 0);
      }
    }
    if (observing && flightState.requestedSector !== null) {
      const sector = Math.max(0, Math.floor(flightState.requestedSector));
      flightState.requestedSector = null;
      // Begin inside the quiet approach corridor. Streaming retains control of
      // forward travel until this destination's maps and shaders are ready.
      flightState.distance = sector * SECTOR_LENGTH;
      observationTarget.current = sector * SECTOR_LENGTH + 1200;
      lastInteraction.current = performance.now();
      look.current.set(0, 0);
      lookTarget.current.set(0, 0);
    }
    if (observing && flightState.autoDrift && !flightState.reducedMotion && !drag.current && !touch.current
      && performance.now() - lastInteraction.current > 1800) {
      observationTarget.current = Math.min(
        observationTarget.current + delta * AUTO_DRIFT_SPEED,
        flightState.distance + MAX_INPUT_LEAD,
      );
    }
    const desired = observing ? observationTarget.current : pageDistance.current;
    flightState.targetDistance = THREE.MathUtils.clamp(
      desired, Math.max(0, flightState.distance - MAX_INPUT_LEAD), flightState.distance + MAX_INPUT_LEAD,
    );
    const remaining = flightState.targetDistance - flightState.distance;
    const movement = THREE.MathUtils.clamp(remaining * (1 - Math.exp(-delta * 2.1)), -MAX_SPEED * delta, MAX_SPEED * delta);
    const nextDistance = Math.max(0, flightState.distance + movement);
    flightState.distance = movement > 0
      ? Math.min(nextDistance, Math.max(flightState.distance, flightState.readyThroughDistance))
      : nextDistance;
    if (!flightState.openingReady) flightState.distance = 0;
    const distance = flightState.distance;
    flightState.sectorIndex = Math.floor(distance / SECTOR_LENGTH);

    const cameraDistance = cameraTravelDistance(distance);
    const worldDistance = travelWorldDistance(cameraDistance);
    flightState.worldDistance = worldDistance;
    flightState.origin = Math.floor(worldDistance / 12_000) * 12_000;
    const nearestIndex = Math.max(0, Math.floor((cameraDistance - ENCOUNTER_OFFSET + SECTOR_LENGTH / 2) / SECTOR_LENGTH));
    if (encounter.current.index !== nearestIndex) encounter.current = createEncounter(nearestIndex);
    const worldRemaining = encounterWorldDistance(nearestIndex) - worldDistance;
    sampleFlightPose(cameraDistance, encounter.current, pose.current, worldRemaining);
    const bodyDistance = Math.abs(worldRemaining);
    flightState.activeSectorName = bodyDistance < 1100 ? encounter.current.name : 'Interstellar transit';

    pointer.current.lerp(pointerTarget.current, 1 - Math.exp(-delta * 3));
    look.current.lerp(lookTarget.current, 1 - Math.exp(-delta * 5));
    const parallax = flightState.reducedMotion ? 0 : 1;
    camera.position.set(
      pose.current.x + pointer.current.x * 1.3 * parallax,
      pose.current.y + pointer.current.y * 0.8 * parallax,
      -worldDistance + flightState.origin,
    );
    let yaw = pose.current.yaw;
    if (camera instanceof THREE.PerspectiveCamera) {
      const aspect = Math.max(1, size.width) / Math.max(1, size.height);
      const baseline = 2 * Math.atan(Math.tan(Math.PI / 8) / Math.min(1, aspect));
      let verticalFov = baseline;
      const opening = 1 - THREE.MathUtils.smoothstep(cameraDistance, 1150, 1500);
      if (opening > 0 && !flightState.inspectSunspots) {
        // Aim between angular bounds, not between world-space positions: the
        // Sun is much closer to the camera than Mercury in this opening shot.
        const [sun, mercury] = openingBodies.current;
        sunView.current.fromArray(sun.position); sunView.current.z += flightState.origin;
        mercuryView.current.fromArray(mercury.position); mercuryView.current.z += flightState.origin;
        sunView.current.sub(camera.position); mercuryView.current.sub(camera.position);
        const sunAngle = Math.atan2(sunView.current.x, -sunView.current.z);
        const mercuryAngle = Math.atan2(mercuryView.current.x, -mercuryView.current.z);
        const sunRadius = Math.asin(Math.min(1, sun.radius / sunView.current.length()));
        const mercuryRadius = Math.asin(Math.min(1, mercury.radius / mercuryView.current.length()));
        const left = Math.min(sunAngle - sunRadius, mercuryAngle - mercuryRadius);
        const right = Math.max(sunAngle + sunRadius, mercuryAngle + mercuryRadius);
        yaw += ((left + right) * .5 - yaw) * opening;
        const required = 2 * Math.atan(Math.tan((right - left + .16) * .5) / aspect);
        verticalFov += (Math.max(baseline, required) - baseline) * opening;
      }
      const degrees = THREE.MathUtils.radToDeg(verticalFov);
      if (Math.abs(camera.fov - degrees) > .001) { camera.fov = degrees; camera.updateProjectionMatrix(); }
    }
    yaw += observing ? look.current.x : 0;
    const pitch = THREE.MathUtils.clamp(pose.current.pitch - (observing ? look.current.y : 0), -1.45, 1.45);
    lookAt.current.set(
      camera.position.x + Math.sin(yaw) * Math.cos(pitch) * 100,
      camera.position.y + Math.sin(pitch) * 100,
      camera.position.z - Math.cos(yaw) * Math.cos(pitch) * 100,
    );
    if (observing && flightState.inspectSunspots && nearestIndex === 0) {
      const solarRoot = scene.children.find((object) => object.userData.encounterIndex === 0);
      const regions = solarRoot?.userData.solarActiveRegions as THREE.Vector3[] | undefined;
      if (regions?.length) {
        if (inspectedRegion.current < 0) {
          // Pick a visible active region once, then follow that same physical
          // feature as the Sun rotates. Dragging releases this inspection view.
          solarRoot!.getWorldPosition(viewDirection.current);
          viewDirection.current.subVectors(camera.position, viewDirection.current).normalize();
          let best = -Infinity;
          for (let index = 0; index < regions.length; index++) {
            solarRoot!.getWorldPosition(regionDirection.current);
            regionDirection.current.subVectors(regions[index], regionDirection.current).normalize();
            const alignment = regionDirection.current.dot(viewDirection.current);
            if (alignment > best) { best = alignment; inspectedRegion.current = index; }
          }
        }
        lookAt.current.copy(regions[inspectedRegion.current]);
      }
    } else inspectedRegion.current = -1;
    camera.lookAt(lookAt.current);
  }, -2);

  return null;
}
