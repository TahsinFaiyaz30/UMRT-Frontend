'use client';

import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { seededRandom } from './encounterCatalog';
import { flightState } from './spaceFlightState';

// Three sparse cells of actual rocks in fixed world coordinates. Camera motion
// produces their parallax; no camera-attached field or size/reveal animation.
const COUNT = 18;
const CELL_LENGTH = 6000;

export function TransitDebris() {
  const scene = useThree((state) => state.scene);
  const field = useRef<{
    mesh: THREE.InstancedMesh; object: THREE.Object3D;
    positions: Float64Array; clock: number; cell: number;
  } | null>(null);
  useLayoutEffect(() => {
    const random = seededRandom(74129);
    const geometry = new THREE.SphereGeometry(1, 48, 32);
    const attribute = geometry.attributes.position;
    const point = new THREE.Vector3();
    const craters = Array.from({ length: 11 }, () => new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize());
    for (let i = 0; i < attribute.count; i++) {
      point.fromBufferAttribute(attribute, i).normalize();
      let radius = 1 + .12 * Math.sin(point.x * 7 + point.z * 4) * Math.cos(point.y * 9);
      for (const crater of craters) {
        const distance = point.distanceTo(crater);
        radius -= .10 * Math.exp(-distance * distance / .018);
        radius += .025 * Math.exp(-((distance - .18) ** 2) / .0014);
      }
      attribute.setXYZ(i, point.x * radius * 1.12, point.y * radius * .88, point.z * radius);
    }
    geometry.computeVertexNormals();
    const material = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vNormal; varying vec3 vPoint;
        void main(){vNormal=normalize(mat3(modelViewMatrix)*mat3(instanceMatrix)*normal);vPoint=position;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 vNormal; varying vec3 vPoint;
        void main(){float light=max(dot(normalize(vNormal),normalize(vec3(-.6,.35,1.))),0.);
        float grain=.87+.13*sin(vPoint.x*71.)*sin(vPoint.y*67.)*sin(vPoint.z*53.);
        gl_FragColor=vec4(vec3(.18,.165,.145)*grain*(.008+light),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
    mesh.name = 'sparse-transit-rocks';
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const positions = new Float64Array(COUNT * 4);
    field.current = { mesh, positions, object: new THREE.Object3D(), clock: 0, cell: NaN };
    scene.add(mesh);
    return () => { field.current = null; scene.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose(); };
  }, [scene]);
  useFrame((_, rawDelta) => {
    const current = field.current;
    if (!current) return;
    const delta = Math.min(rawDelta, .05);
    if (!flightState.reducedMotion) current.clock += delta;
    const { mesh, object, positions } = current;
    const cell = Math.floor(flightState.worldDistance / CELL_LENGTH);
    if (current.cell !== cell) {
      current.cell = cell;
      for (let group = 0; group < 3; group++) {
        const index = cell + group - 1;
        const random = seededRandom(index * 49157 + 74129);
        for (let rock = 0; rock < 6; rock++) {
          const offset = (group * 6 + rock) * 4;
          positions[offset] = (random() - .5) * 1600;
          positions[offset + 1] = (random() - .5) * 1000;
          positions[offset + 2] = -(index + random()) * CELL_LENGTH;
          positions[offset + 3] = 1.2 + random() * 2;
        }
      }
    }
    for (let i = 0; i < COUNT; i++) {
      const phase = positions[i * 4 + 2] * .01;
      object.position.set(positions[i * 4], positions[i * 4 + 1], positions[i * 4 + 2] + flightState.origin);
      object.rotation.set(phase + current.clock * .045, phase * 1.4 + current.clock * .027, phase * .3);
      object.scale.setScalar(positions[i * 4 + 3]);
      object.updateMatrix(); mesh.setMatrixAt(i, object.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, -.5);
  return null;
}
