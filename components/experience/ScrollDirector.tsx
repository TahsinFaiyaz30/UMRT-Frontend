'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, PerspectiveCamera } from 'three';
import * as THREE from 'three';
import { cameraConfig, modelConfig } from '@/lib/modelConfig';
import {
  phases,
  modelOffsetXAt,
  phaseAt,
  activeHotspot,
  clamp,
  easedProgress,
  localProgress,
} from '@/lib/scrollTimeline';
import type { ModelRigHandle } from './ModelRig';

/**
 * Reads normalised scroll progress from `progressRef.current` and
 * drives:
 *  - camera position + look-at target
 *  - horizontal model offset
 *  - subtle model rotation
 *  - exposure / vignette via tone mapping exposure
 *
 * No React state is used inside useFrame; everything is mutated
 * on the underlying Three.js objects.
 */
export function ScrollDirector({
  progressRef,
  rigRef,
  cameraGroupRef,
  reduceMotion,
}: {
  progressRef: React.RefObject<number>;
  rigRef: React.RefObject<ModelRigHandle | null>;
  cameraGroupRef?: React.RefObject<Group | null>;
  reduceMotion?: boolean;
}) {
  const { camera, scene } = useThree();
  const targetVec = useRef(new THREE.Vector3()).current;
  const camPosVec = useRef(new THREE.Vector3()).current;
  const lastProgress = useRef(-1);

  useFrame(() => {
    const cameraObj = camera as PerspectiveCamera;
    const global = clamp(progressRef.current ?? 0);

    // --- Free-explore phase: yield all control to OrbitControls ---
    if (global >= phases[phases.length - 1].start) {
      scene.userData.freeExploreActive = true;
      lastProgress.current = global;
      return; // Stop driving camera/model — OrbitControls handles everything now.
    }
    scene.userData.freeExploreActive = false;

    const phase = phaseAt(global);
    const hp = activeHotspot(global);

    // --- CAMERA position ---
    // We interpolate between three anchor states (start, reveal, closeup)
    // plus a per-hotspot closeup override.
    let camTarget: [number, number, number] = cameraConfig.start;
    let tgtTarget: [number, number, number] = cameraConfig.targetStart;

    if (global < 0.28) {
      // start (hero_intro + zoom_in)
      const local = clamp((global - 0.0) / 0.28);
      camTarget = lerpV3(cameraConfig.start, cameraConfig.reveal, easedInOut(local));
      tgtTarget = lerpV3(cameraConfig.targetStart, cameraConfig.targetReveal, easedInOut(local));
    } else if (global < 0.42) {
      // full reveal: stable
      camTarget = cameraConfig.reveal;
      tgtTarget = cameraConfig.targetReveal;
    } else if (global < 0.94 && hp !== null && phase.hotspotIndex !== null) {
      // hotspot-driven phase
      const local = easedProgress(phase, global);
      const h = modelConfig.hotspots[hp];
      const offsetCam: [number, number, number] = [
        cameraConfig.closeup[0] + (h.position[0] ?? 0) * 0.2,
        cameraConfig.closeup[1],
        cameraConfig.closeup[2],
      ];
      const offsetTgt: [number, number, number] = [
        h.focusTarget[0] ?? 0,
        h.focusTarget[1] ?? 1,
        h.focusTarget[2] ?? 0,
      ];
      const prevOffset: [number, number, number] = [
        cameraConfig.reveal[0],
        cameraConfig.reveal[1],
        cameraConfig.reveal[2],
      ];
      camTarget = lerpV3(prevOffset, offsetCam, local);
      tgtTarget = lerpV3(cameraConfig.targetReveal, offsetTgt, local);
    } else {
      // final_recenter: blend back to reveal framing.
      const local = clamp((global - 0.82) / 0.12);
      camTarget = lerpV3(
        [cameraConfig.closeup[0] + 0.3, cameraConfig.closeup[1], cameraConfig.closeup[2]],
        cameraConfig.reveal,
        easedInOut(local),
      );
      tgtTarget = lerpV3(cameraConfig.targetReveal, cameraConfig.targetReveal, local);
    }

    // --- Reduce motion: dampen movement ---
    if (reduceMotion) {
      // Skip aggressive camera moves; stay near the reveal framing.
      if (global < 0.28) {
        camTarget = cameraConfig.reveal;
        tgtTarget = cameraConfig.targetReveal;
      } else {
        // For full reveal onwards, keep camera at reveal framing.
        camTarget = cameraConfig.reveal;
        tgtTarget = cameraConfig.targetReveal;
      }
    }

    camPosVec.set(camTarget[0], camTarget[1], camTarget[2]);
    targetVec.set(tgtTarget[0], tgtTarget[1], tgtTarget[2]);

    // damping
    const damp = 0.12;
    cameraObj.position.lerp(camPosVec, damp);
    // smooth look-at using a tiny dummy Object3D as the controls target
    if (cameraGroupRef?.current) {
      cameraGroupRef.current.position.lerp(targetVec, damp);
      cameraObj.lookAt(cameraGroupRef.current.position);
    } else {
      cameraObj.lookAt(targetVec);
    }

    // --- MODEL offset ---
    const targetOffsetX = modelOffsetXAt(global) * (1.4); // amplify per config
    if (rigRef.current) {
      rigRef.current.setOffsetX(targetOffsetX);
      const g = rigRef.current.group;
      if (g) {
        // subtle model rotation tied to scroll for cinematic feel
        g.rotation.y = modelConfig.rotationY + Math.sin(global * Math.PI * 2) * 0.06;
      }
    }

    // touch terrain shading via toneMappingExposure (cheap "vignette" hint)
    (cameraObj as unknown as { toneMappingExposure?: number }).toneMappingExposure =
      1.0 + Math.sin(global * Math.PI) * 0.08;

    lastProgress.current = global;
  });

  return null;
}

function lerpV3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  const k = clamp(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function easedInOut(t: number) {
  const x = clamp(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// localProgress is exposed for future phase helpers.
void localProgress;
