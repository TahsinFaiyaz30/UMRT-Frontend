'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
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

const CAMERA_PATH: CameraKeyframe[] = [
  { at: 0.00, position: [5.25, 2.65, 8.1], target: [0, 1.05, 0], fov: 34 },
  { at: 0.12, position: [3.15, 2.25, 5.65], target: [0, 1.02, 0], fov: 32 },
  { at: 0.25, position: [-4.05, 2.35, 5.5], target: [0, 1.0, 0], fov: 35 },
  { at: 0.38, position: [2.15, 2.15, 3.55], target: [0, 1.58, 0.15], fov: 31 },
  { at: 0.51, position: [-3.5, 1.65, 4.0], target: [-0.62, 0.95, 0.42], fov: 33 },
  { at: 0.64, position: [3.65, 1.08, 3.95], target: [0.32, 0.58, 0.18], fov: 34 },
  { at: 0.76, position: [0.15, 2.65, 7.25], target: [0, 1.0, 0.15], fov: 36 },
  { at: 0.84, position: [-0.25, 2.85, 8.2], target: [0, 1.08, 0.1], fov: 37 },
  { at: 0.92, position: [4.35, 2.35, 6.45], target: [0, 1.0, 0], fov: 35 },
];

function easeInOut(value: number) {
  const x = clamp(value);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function samplePath(progress: number) {
  let nextIndex = CAMERA_PATH.findIndex((frame) => progress <= frame.at);
  if (nextIndex <= 0) nextIndex = 1;
  if (nextIndex < 0) nextIndex = CAMERA_PATH.length - 1;
  const previous = CAMERA_PATH[nextIndex - 1];
  const next = CAMERA_PATH[nextIndex];
  const local = easeInOut((progress - previous.at) / Math.max(0.001, next.at - previous.at));
  return { previous, next, local };
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

  useFrame((_, delta) => {
    const progress = clamp(progressRef.current ?? 0);
    if (progress >= phases[phases.length - 1].start) {
      scene.userData.freeExploreActive = true;
      return;
    }
    scene.userData.freeExploreActive = false;

    const cameraObject = camera as PerspectiveCamera;
    const { previous, next, local } = samplePath(reduceMotion ? Math.min(progress, 0.25) : progress);
    desiredPosition.set(...previous.position).lerp(nextPosition.set(...next.position), local);
    desiredTarget.set(...previous.target).lerp(nextTarget.set(...next.target), local);

    const mobile = size.width < 720;
    if (mobile) {
      const distance = desiredPosition.clone().sub(desiredTarget).multiplyScalar(1.22);
      desiredPosition.copy(desiredTarget).add(distance);
      desiredTarget.y -= 0.08;
    }

    if (!reduceMotion) {
      const pointer = pointerRef.current ?? { x: 0, y: 0 };
      desiredPosition.x += pointer.x * (mobile ? 0.05 : 0.16);
      desiredPosition.y -= pointer.y * (mobile ? 0.03 : 0.1);
      desiredTarget.x += pointer.x * 0.055;
      desiredTarget.y -= pointer.y * 0.035;
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

    if (rigRef.current) {
      rigRef.current.setOffsetX(modelOffsetXAt(progress));
      const group = rigRef.current.group;
      if (group) {
        group.position.y = modelConfig.basePosition[1];
      }
    }

    gl.toneMappingExposure = 1.08 + Math.sin(progress * Math.PI) * 0.18;
  });

  return null;
}
