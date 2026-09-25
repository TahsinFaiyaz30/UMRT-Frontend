'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useFrame, useThree } from '@react-three/fiber';
import { createEncounter } from './encounterCatalog';
import { createEncounterObject } from './encounterObjects';
import { EncounterStream } from './encounterStream';
import { flightState } from './spaceFlightState';
import { encounterPrefetch, encounterWorldDistance, openingPairReady } from './encounterPresentation';
import { prepareEncounterShaders } from './shaderPreparation';
import { SECTOR_LENGTH } from './spaceTypes';

type EncounterObject = ReturnType<typeof createEncounterObject>;

function scheduleIdle(work: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(work, { timeout: 180 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(work, 32);
  return () => window.clearTimeout(id);
}

/** No texture queue or entire-universe allocation: one encounter per idle task. */
export function CelestialVoyage({ onOpeningReady }: { onOpeningReady: (ready: boolean) => void }) {
  const { gl, scene, camera, invalidate } = useThree();
  const pathname = usePathname();
  const streamRef = useRef<EncounterStream<EncounterObject> | null>(null);
  const clockRef = useRef(0);
  const planRef = useRef({ key: -1, requested: [0] });
  const telemetryTime = useRef(0);
  const opened = useRef(false);

  useEffect(() => {
    let retired = false;
    const controller = new AbortController();
    planRef.current.key = -1;
    opened.current = false;
    flightState.openingReady = false;
    flightState.readyThroughDistance = 0;
    onOpeningReady(false);
    const stream = new EncounterStream<EncounterObject>({
      create: (index) => createEncounterObject(createEncounter(index)),
      prepare: async (object) => {
        await object.prepare?.(controller.signal);
        await prepareEncounterShaders(gl, object.group, camera, scene, controller.signal);
      },
      mount: (object, index) => {
        const descriptor = createEncounter(index);
        object.group.position.set(...descriptor.position);
        object.group.position.z = -encounterWorldDistance(index) + flightState.origin;
        object.group.name = `encounter-${index}-${descriptor.kind}`;
        object.group.userData.encounterIndex = index;
        object.group.visible = false;
        scene.add(object.group);
      },
      unmount: (object) => {
        scene.remove(object.group);
      },
      schedule: scheduleIdle,
      changed: () => { if (!retired) invalidate(); },
      error: (error) => { console.error('Space encounter preparation failed:', error); },
    });
    streamRef.current = stream;
    invalidate();
    const retire = () => {
      retired = true;
      streamRef.current = null;
      stream.dispose();
      controller.abort();
      delete scene.userData.spaceVoyage;
    };
    // Retire before the preparation poller sees the same loss event. Abort
    // cancels its timer, and a restored context gets a new scene subtree.
    gl.domElement.addEventListener('webglcontextlost', retire);
    return () => {
      gl.domElement.removeEventListener('webglcontextlost', retire);
      retire();
    };
  }, [gl, scene, camera, invalidate, pathname, onOpeningReady]);

  useFrame((_, delta) => {
    const stream = streamRef.current;
    if (!stream) return;
    if (!opened.current && openingPairReady(stream.live)) {
      opened.current = true;
      flightState.openingReady = true;
      onOpeningReady(true);
    }
    const sector = Math.max(0, Math.floor(flightState.distance / SECTOR_LENGTH));
    const localDistance = flightState.distance - sector * SECTOR_LENGTH;
    // The opening frames the actual next planet with the Sun. Prepare that
    // existing encounter immediately after the Sun, still one job at a time.
    const prepareAhead = encounterPrefetch(sector, localDistance);
    const planKey = opened.current ? sector * 2 + Number(prepareAhead) : -2;
    if (planRef.current.key !== planKey) {
      const requested = opened.current ? [sector] : [0, 1];
      if (opened.current && prepareAhead) requested.push(sector + 1);
      if (opened.current && sector > 0) requested.push(sector - 1);
      planRef.current = { key: planKey, requested };
      stream.update(requested, opened.current ? [sector - 1, sector, sector + 1] : [0, 1]);
    } else stream.tick();

    // Only the space camera waits for a cold GPU, never the page content.
    let firstMissing = sector;
    while (stream.live.has(firstMissing) || stream.exhausted.has(firstMissing)) firstMissing += 1;
    // A cold destination mounts while still tens of thousands of units away.
    // The camera then resumes through the same fixed world as the star field.
    flightState.readyThroughDistance = opened.current ? firstMissing * SECTOR_LENGTH : 0;
    flightState.generationState = planRef.current.requested.every((index) => stream.live.has(index)) ? 'ready' : 'preparing';

    if (!flightState.reducedMotion) clockRef.current += Math.min(delta, 0.05);
    for (const [index, object] of stream.live) {
      object.group.position.z = -encounterWorldDistance(index) + flightState.origin;
      object.group.visible = opened.current;
      object.update(clockRef.current, flightState.reducedMotion ? 0 : Math.min(delta, 0.05));
    }
    telemetryTime.current += delta;
    if (process.env.NODE_ENV !== 'production' && telemetryTime.current > 0.5) {
      telemetryTime.current = 0;
      scene.userData.spaceVoyage = {
        sector, distance: flightState.distance,
        resident: Array.from(stream.live.keys()),
        preparing: flightState.generationState,
      };
    }
  }, -1);

  return null;
}
