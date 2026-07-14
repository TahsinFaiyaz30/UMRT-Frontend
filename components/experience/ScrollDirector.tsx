'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, PerspectiveCamera } from 'three';
import * as THREE from 'three';
import { modelConfig } from '@/lib/modelConfig';
import { clamp, modelOffsetXAt, phases } from '@/lib/scrollTimeline';
import type { ModelRigHandle } from './ModelRig';

type CameraKeyframe = {
  at: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
};

type CameraPathSample = {
  previous: CameraKeyframe;
  next: CameraKeyframe;
  local: number;
};

const CAMERA_PATH: CameraKeyframe[] = [
  { at: 0.00, position: [5.45, 1.55, 7.0], target: [0.3, 0.72, 0], fov: 32 },
  { at: 0.12, position: [3.15, 2.25, 5.65], target: [0.35, 1.02, 0], fov: 32 },
  { at: 0.25, position: [-4.05, 2.35, 5.5], target: [0, 1.0, 0], fov: 35 },
  { at: 0.38, position: [2.15, 2.15, 3.55], target: [0, 1.58, 0.15], fov: 31 },
  { at: 0.51, position: [-3.5, 1.65, 4.0], target: [-0.62, 0.95, 0.42], fov: 33 },
  { at: 0.64, position: [3.65, 1.08, 3.95], target: [0.32, 0.58, 0.18], fov: 34 },
  { at: 0.76, position: [0.15, 2.65, 7.25], target: [0, 1.0, 0.15], fov: 36 },
  { at: 0.84, position: [-0.25, 2.45, 8.2], target: [0, 0.9, 0.1], fov: 36 },
  { at: 0.92, position: [5.15, 1.7, 6.85], target: [0, 0.82, 0], fov: 33 },
];

// The 28 m shadow camera spans about 0.014 world units per texel at 2048 px.
// Accumulate sub-texel movement and refresh only once it can affect a shadow.
const SHADOW_CASTER_MOVEMENT_EPSILON = 0.006;
const SHADOW_SETTLE_MS = 120;

function easeInOut(value: number) {
  const x = clamp(value);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function samplePath(progress: number, result: CameraPathSample) {
  let nextIndex = 1;
  while (nextIndex < CAMERA_PATH.length - 1 && progress > CAMERA_PATH[nextIndex].at) {
    nextIndex += 1;
  }
  const previous = CAMERA_PATH[nextIndex - 1];
  const next = CAMERA_PATH[nextIndex];
  result.previous = previous;
  result.next = next;
  result.local = easeInOut((progress - previous.at) / Math.max(0.001, next.at - previous.at));
  return result;
}

export function ScrollDirector({
  progressRef,
  pointerRef,
  rigRef,
  cameraGroupRef,
  reduceMotion,
}: {
  progressRef: React.RefObject<number>;
  pointerRef: React.RefObject<{ x: number; y: number }>;
  rigRef: React.RefObject<ModelRigHandle | null>;
  cameraGroupRef?: React.RefObject<Group | null>;
  reduceMotion?: boolean;
}) {
  const { camera, scene, size, gl } = useThree();
  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const nextPosition = useMemo(() => new THREE.Vector3(), []);
  const nextTarget = useMemo(() => new THREE.Vector3(), []);
  const mobileDistance = useMemo(() => new THREE.Vector3(), []);
  const pathSample = useMemo<CameraPathSample>(() => ({
    previous: CAMERA_PATH[0],
    next: CAMERA_PATH[1],
    local: 0,
  }), []);
  const shadowedModelOffset = useRef(Number.NaN);
  const shadowMovementAt = useRef(Number.NEGATIVE_INFINITY);
  const shadowUpdatePending = useRef(false);

  const positionRig = (progress: number, now: number) => {
    const rig = rigRef.current;
    if (!rig) return;
    const offset = modelOffsetXAt(progress);
    rig.setOffsetX(offset);
    const group = rig.group;
    if (!group) return;
    const yMoved = Math.abs(group.position.y - modelConfig.basePosition[1]) > 0.0001;
    group.position.y = modelConfig.basePosition[1];
    const offsetChanged = (
      !Number.isFinite(shadowedModelOffset.current)
      || Math.abs(offset - shadowedModelOffset.current) >= SHADOW_CASTER_MOVEMENT_EPSILON
    );
    const firstPosition = !Number.isFinite(shadowedModelOffset.current);
    if (offsetChanged || yMoved) {
      shadowedModelOffset.current = offset;
      shadowMovementAt.current = now;
      shadowUpdatePending.current = true;
    }

    // During eased scrolling the rover can move a fraction every frame. Wait
    // for that motion to settle, then refresh once; repeatedly redrawing the
    // entire shadow map while the camera is moving creates visible frame
    // spikes. The initial position remains immediate.
    if (
      shadowUpdatePending.current
      && (firstPosition || now - shadowMovementAt.current >= SHADOW_SETTLE_MS)
    ) {
      shadowUpdatePending.current = false;
      gl.shadowMap.needsUpdate = true;
    }
  };

  useFrame((state, delta) => {
    const progress = clamp(progressRef.current ?? 0);
    if (progress >= phases[phases.length - 1].start) {
      scene.userData.freeExploreActive = true;
      positionRig(progress, state.clock.elapsedTime * 1_000);
      return;
    }
    scene.userData.freeExploreActive = false;

    const cameraObject = camera as PerspectiveCamera;
    const { previous, next, local } = samplePath(
      reduceMotion ? Math.min(progress, 0.25) : progress,
      pathSample,
    );
    desiredPosition.set(...previous.position).lerp(nextPosition.set(...next.position), local);
    desiredTarget.set(...previous.target).lerp(nextTarget.set(...next.target), local);

    const mobile = size.width < 720;
    if (mobile) {
      mobileDistance.copy(desiredPosition).sub(desiredTarget).multiplyScalar(1.22);
      desiredPosition.copy(desiredTarget).add(mobileDistance);
      desiredTarget.y -= 0.08;
    }

    if (!reduceMotion) {
      const pointerX = pointerRef.current?.x ?? 0;
      const pointerY = pointerRef.current?.y ?? 0;
      desiredPosition.x += pointerX * (mobile ? 0.05 : 0.16);
      desiredPosition.y -= pointerY * (mobile ? 0.03 : 0.1);
      desiredTarget.x += pointerX * 0.055;
      desiredTarget.y -= pointerY * 0.035;
    }

    const damping = 1 - Math.exp(-delta * 5.4);
    cameraObject.position.lerp(desiredPosition, damping);
    if (cameraGroupRef?.current) {
      cameraGroupRef.current.position.lerp(desiredTarget, damping);
      cameraObject.lookAt(cameraGroupRef.current.position);
    } else {
      cameraObject.lookAt(desiredTarget);
    }
    if (!reduceMotion) {
      cameraObject.rotateZ(Math.sin(progress * Math.PI * 5.5) * 0.012);
    }

    const desiredFov = (previous.fov + (next.fov - previous.fov) * local) + (mobile ? 5 : 0);
    if (Math.abs(cameraObject.fov - desiredFov) > 0.01) {
      cameraObject.fov += (desiredFov - cameraObject.fov) * damping;
      cameraObject.updateProjectionMatrix();
    }

    positionRig(progress, state.clock.elapsedTime * 1_000);

    gl.toneMappingExposure = 1.16;
  });

  return null;
}
