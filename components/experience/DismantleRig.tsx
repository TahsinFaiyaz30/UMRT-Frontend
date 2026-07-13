'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  teardownMotions,
  internalModules,
  materialPalette,
  smooth,
  localT,
  type InternalModuleDef,
  type MaterialDef,
} from '@/lib/teardownConfig';
import { modelConfig } from '@/lib/modelConfig';
import { disposeMaterials, disposeObjectResources } from '@/lib/threeDisposal';

/**
 * IN-PLACE rover teardown that lives inside the main Mars scene.
 *
 * Re-creates the original semantic-real-teardown effect from
 * `curiosity_semantic_real_teardown/index.html`, but as a React Three
 * Fiber component mounted *inside* HeroScene so the rover stays put on
 * Mars while it jumps, explodes, reveals the internal science / avionics
 * modules, and reassembles — all on the same stage.
 *
 * Pipeline:
 *   1. Lift (jump up off the dust → hover → drop back), 0→1→0 over t.
 *   2. External subsystems (wheels, mast, deck, etc.) fly outward
 *      using their `teardownMotions` explode vector and rotation.
 *   3. Internal modules (SAM, CheMin, avionics, power, wiring harness)
 *      fade in once the body has opened enough, then explode outward
 *      using the vectors in `internalModules`.
 *   4. As t ramps back down to 0, everything returns to its rest pose.
 */

type SemanticGroup = THREE.Group & {
  userData: {
    label: string;
    original: THREE.Vector3;
    explode: THREE.Vector3;
    rot: THREE.Euler;
    start: number;
    end: number;
  };
};

type InternalGroup = THREE.Group & {
  userData: {
    name: string;
    original: THREE.Vector3;
    explode: THREE.Vector3;
    rot: THREE.Euler;
    start: number;
    end: number;
  };
};

/* ------------------------------------------------------------------ */
/*  Material factory (balanced quality — matches original teardown)  */
/* ------------------------------------------------------------------ */

function makeMat(def: MaterialDef): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: def.color,
    metalness: def.metalness,
    roughness: def.roughness,
    envMapIntensity: def.envMapIntensity,
  });
}

/* ------------------------------------------------------------------ */
/*  Geometry helpers                                                  */
/* ------------------------------------------------------------------ */

function addBox(
  parent: THREE.Object3D,
  pos: [number, number, number],
  scale: [number, number, number],
  mat: THREE.MeshStandardMaterial,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(scale[0], scale[1], scale[2]), mat);
  m.position.set(pos[0], pos[1], pos[2]);
  parent.add(m);
  return m;
}

function addCylinder(
  parent: THREE.Object3D,
  pos: [number, number, number],
  radius: number,
  height: number,
  mat: THREE.MeshStandardMaterial,
  axis: 'x' | 'y' | 'z' = 'y',
  seg = 20,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, seg), mat);
  m.position.set(pos[0], pos[1], pos[2]);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  parent.add(m);
  return m;
}

function addRod(
  parent: THREE.Object3D,
  a: [number, number, number],
  b: [number, number, number],
  radius: number,
  mat: THREE.MeshStandardMaterial,
): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat);
  m.position.copy(mid);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  parent.add(m);
  return m;
}

function addPCB(
  parent: THREE.Object3D,
  pos: [number, number, number],
  size: [number, number, number] = [0.4, 0.035, 0.28],
  chips = 5,
  mats: Record<string, THREE.MeshStandardMaterial>,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);

  addBox(g, [0, 0, 0], size, mats.pcb);
  for (let i = 0; i < 10; i++) {
    addBox(
      g,
      [
        -size[0] * 0.2 + (i % 3) * 0.08,
        size[1] / 2 + 0.006,
        -size[2] * 0.42 + i * size[2] * 0.08,
      ],
      [size[0] * 0.52, 0.006, 0.006],
      mats.copper,
    );
  }
  for (let i = 0; i < chips; i++) {
    const x = (i % 3 - 1) * size[0] * 0.22;
    const z = (Math.floor(i / 3) - 0.5) * size[2] * 0.28;
    addBox(g, [x, size[1] / 2 + 0.028, z], [size[0] * 0.15, 0.045, size[2] * 0.13], mats.chip);
    for (let p = 0; p < 6; p++) {
      addBox(
        g,
        [x - size[0] * 0.09, size[1] / 2 + 0.034, z + (p - 2.5) * size[2] * 0.018],
        [0.014, 0.01, 0.004],
        mats.metal,
      );
      addBox(
        g,
        [x + size[0] * 0.09, size[1] / 2 + 0.034, z + (p - 2.5) * size[2] * 0.018],
        [0.014, 0.01, 0.004],
        mats.metal,
      );
    }
  }
  for (let i = 0; i < 6; i++) {
    addCylinder(
      g,
      [
        -size[0] * 0.38 + (i % 3) * size[0] * 0.32,
        size[1] / 2 + 0.04,
        -size[2] * 0.3 + Math.floor(i / 3) * size[2] * 0.25,
      ],
      0.017,
      0.055,
      mats.blue,
      'y',
      14,
    );
  }
  return g;
}

/* ------------------------------------------------------------------ */
/*  Build procedural internal modules                                 */
/* ------------------------------------------------------------------ */

function buildInternals(
  mats: Record<string, THREE.MeshStandardMaterial>,
): InternalGroup[] {
  const groups: InternalGroup[] = [];

  function makeGroup(def: InternalModuleDef): InternalGroup {
    const g = new THREE.Group() as InternalGroup;
    g.userData = {
      name: def.name,
      original: new THREE.Vector3(),
      explode: new THREE.Vector3(...def.explode),
      rot: new THREE.Euler(...def.rot),
      start: def.start,
      end: def.end,
    };
    groups.push(g);
    return g;
  }

  // ----- SAM suite -----
  const sam = makeGroup(internalModules[0]);
  addBox(sam, [-0.4, 0.92, 0.48], [0.035, 0.09, 0.5], mats.metal);
  addBox(sam, [-0.05, 0.92, 0.48], [0.035, 0.09, 0.5], mats.metal);
  addCylinder(sam, [-0.23, 1.0, 0.25], 0.11, 0.035, mats.gold, 'y', 32);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    addCylinder(
      sam,
      [-0.23 + Math.cos(a) * 0.075, 1.03, 0.25 + Math.sin(a) * 0.075],
      0.016,
      0.035,
      mats.darkMetal,
      'y',
      12,
    );
  }
  // helical tubing
  let prev: [number, number, number] | null = null;
  for (let i = 0; i < 70; i++) {
    const t = (i / 69) * Math.PI * 7;
    const p: [number, number, number] = [
      -0.33 + Math.cos(t) * 0.075,
      1.1 + (i / 69) * 0.14,
      0.61 + Math.sin(t) * 0.075,
    ];
    if (prev) addRod(sam, prev, p, 0.006, mats.copper);
    prev = p;
  }
  addCylinder(sam, [-0.1, 1.08, 0.42], 0.055, 0.22, mats.darkMetal, 'z', 24);
  addBox(sam, [-0.15, 1.15, 0.72], [0.26, 0.05, 0.12], mats.blue);
  addPCB(sam, [-0.3, 1.16, 0.38], [0.32, 0.025, 0.2], 4, mats);

  // ----- CheMin -----
  const chemin = makeGroup(internalModules[1]);
  addBox(chemin, [0.25, 0.88, 0.42], [0.42, 0.045, 0.42], mats.white);
  addCylinder(chemin, [0.25, 1.06, 0.42], 0.12, 0.025, mats.darkMetal, 'y', 36);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addCylinder(
      chemin,
      [0.25 + Math.cos(a) * 0.075, 1.09, 0.42 + Math.sin(a) * 0.075],
      0.014,
      0.025,
      mats.gold,
      'y',
      12,
    );
  }
  addRod(chemin, [0.05, 1.13, 0.28], [0.19, 1.08, 0.38], 0.025, mats.blue);
  addBox(chemin, [0.42, 1.1, 0.55], [0.11, 0.035, 0.16], mats.cyan);
  addPCB(chemin, [0.25, 1.18, 0.17], [0.3, 0.025, 0.18], 3, mats);

  // ----- Avionics (2x RAD750 PCBs) -----
  const avionics = makeGroup(internalModules[2]);
  addPCB(avionics, [-0.28, 1.08, -0.2], [0.4, 0.035, 0.3], 6, mats);
  addPCB(avionics, [0.28, 1.08, -0.2], [0.4, 0.035, 0.3], 6, mats);
  addBox(avionics, [-0.28, 1.15, -0.2], [0.12, 0.018, 0.1], mats.metal);
  addBox(avionics, [0.28, 1.15, -0.2], [0.12, 0.018, 0.1], mats.metal);

  // ----- Power / batteries / radios -----
  const power = makeGroup(internalModules[3]);
  addPCB(power, [0.0, 0.82, -0.58], [0.5, 0.035, 0.3], 4, mats);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      addCylinder(power, [side * 0.5, 0.86, -0.4 + i * 0.12], 0.035, 0.18, mats.blue, 'y', 18);
    }
  }
  addPCB(power, [-0.44, 1.12, -0.76], [0.26, 0.025, 0.2], 3, mats);
  addPCB(power, [0.44, 1.12, -0.76], [0.26, 0.025, 0.2], 3, mats);

  // ----- Wiring harness -----
  const wires = makeGroup(internalModules[4]);
  for (let i = 0; i < 6; i++) {
    addRod(
      wires,
      [-0.3 + i * 0.015, 1.08, 0.4],
      [0.0 + i * 0.015, 0.86, -0.5],
      0.006,
      i % 2 ? mats.gold : mats.copper,
    );
  }
  for (let i = 0; i < 6; i++) {
    addRod(
      wires,
      [0.3 - i * 0.015, 1.08, 0.34],
      [0.0 - i * 0.015, 0.86, -0.5],
      0.006,
      i % 2 ? mats.cyan : mats.copper,
    );
  }

  // Each module moves and fades as one semantic unit. Merge its hundreds of
  // tiny boxes, pins, rods, and cylinders by material before they ever reach
  // WebGL. Baking the existing local transforms into the merged buffers keeps
  // the exact shape while collapsing hundreds of geometries, materials, draw
  // calls, and shader bookkeeping objects to a few dozen.
  for (const g of groups) {
    g.userData.original.copy(g.position);
    g.updateMatrixWorld(true);
    const inverseGroupMatrix = g.matrixWorld.clone().invert();
    const geometriesByMaterial = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
    const sourceGeometries = new Set<THREE.BufferGeometry>();

    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const sourceMaterial = (Array.isArray(mesh.material)
        ? mesh.material[0]
        : mesh.material) as THREE.MeshStandardMaterial;
      const relativeMatrix = inverseGroupMatrix.clone().multiply(mesh.matrixWorld);
      const geometry = mesh.geometry.clone().applyMatrix4(relativeMatrix);
      const bucket = geometriesByMaterial.get(sourceMaterial) ?? [];
      bucket.push(geometry);
      geometriesByMaterial.set(sourceMaterial, bucket);
      sourceGeometries.add(mesh.geometry);
    });

    g.clear();
    sourceGeometries.forEach((geometry) => geometry.dispose());

    geometriesByMaterial.forEach((geometries, sourceMaterial) => {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((geometry) => geometry.dispose());
      if (!merged) return;

      const material = sourceMaterial.clone();
      material.transparent = true;
      material.opacity = 0;
      material.depthWrite = false;
      material.needsUpdate = true;
      const mesh = new THREE.Mesh(merged, material);
      mesh.layers.enable(1);
      g.add(mesh);
    });
  }

  return groups;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function DismantleRig({
  progressRef,
  timelineRef,
}: {
  progressRef: RefObject<number>;
  timelineRef?: RefObject<number>;
}) {
  const gltf = useGLTF(modelConfig.mainPath);
  const rootRef = useRef<THREE.Group>(null);
  const occluderRef = useRef<THREE.Mesh>(null);
  const semanticPartsRef = useRef<SemanticGroup[]>([]);
  const internalsRef = useRef<InternalGroup[]>([]);
  const initializedRef = useRef(false);

  // Materials — initialized once. Same palette as the original V4
  // teardown, configured for the "balanced" quality preset (envMap
  // intensity tuned so PBR reflections read on dark materials but don't
  // blow out highlights).
  const mats = useMemo(() => {
    const out: Record<string, THREE.MeshStandardMaterial> = {};
    for (const [k, def] of Object.entries(materialPalette)) {
      out[k] = makeMat(def);
    }
    return out;
  }, []);

  useEffect(() => () => {
    Object.values(mats).forEach((material) => material.dispose());
  }, [mats]);

  useEffect(() => {
    if (initializedRef.current) return;
    const root = rootRef.current;
    if (!root || !gltf?.scene) return;
    initializedRef.current = true;

    // -------- External subsystems (from GLB) --------
    const cloned = gltf.scene.clone(true);
    const labelGroups: Record<string, SemanticGroup> = {};
    const semParts: SemanticGroup[] = [];
    const clonedMaterialCache = new Map<THREE.Material, THREE.Material>();
    const cloneMaterial = (material: THREE.Material) => {
      const cached = clonedMaterialCache.get(material);
      if (cached) return cached;
      const clone = material.clone();
      clonedMaterialCache.set(material, clone);
      return clone;
    };

    cloned.updateMatrixWorld(true);
    const collected: { mesh: THREE.Mesh; label: string; matrix: THREE.Matrix4 }[] = [];
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.layers.enable(1);
      const label = mesh.name.split('__')[0];
      if (!teardownMotions[label]) return;
      // The GLTF loader cache owns the source materials. Each temporary
      // teardown gets independent clones so it can release shader programs
      // without mutating or invalidating the assembled rover.
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(cloneMaterial)
        : cloneMaterial(mesh.material);
      // Boost env map intensity on the rover's own materials so they
      // sit nicely alongside the procedural internals.
      const matArr = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of matArr as THREE.MeshStandardMaterial[]) {
        if (mat?.envMapIntensity !== undefined) {
          mat.envMapIntensity = 1.2;
          mat.needsUpdate = true;
        }
      }
      collected.push({ mesh, label, matrix: mesh.matrixWorld.clone() });
    });

    for (const { mesh, label, matrix } of collected) {
      let g = labelGroups[label];
      if (!g) {
        const motion = teardownMotions[label];
        const ng = new THREE.Group() as SemanticGroup;
        ng.userData = {
          label,
          original: new THREE.Vector3(),
          explode: new THREE.Vector3(...motion.explode),
          rot: new THREE.Euler(...motion.rot),
          start: motion.start,
          end: motion.end,
        };
        root.add(ng);
        labelGroups[label] = ng;
        semParts.push(ng);
        g = ng;
      }
      g.add(mesh);
      matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.updateMatrix();
      g.userData.original.set(0, 0, 0);
    }
    semanticPartsRef.current = semParts;

    // -------- Procedural internals (SAM, CheMin, avionics, power, wires) --------
    const internals = buildInternals(mats);
    for (const g of internals) root.add(g);
    internalsRef.current = internals;

    return () => {
      // External meshes share GLTF geometry but own their cloned materials.
      const disposedExternalMaterials = new Set<THREE.Material>();
      semParts.forEach((group) => {
        group.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh) {
            disposeMaterials(mesh.material, false, disposedExternalMaterials);
          }
        });
        root.remove(group);
        group.clear();
      });

      // The internal modules are entirely procedural and own both sides of
      // every GPU allocation.
      internals.forEach((group) => {
        disposeObjectResources(group, {
          geometries: true,
          materials: true,
          textures: false,
        });
        root.remove(group);
        group.clear();
      });

      semanticPartsRef.current = [];
      internalsRef.current = [];
      initializedRef.current = false;
    };
  }, [gltf, mats]);

  // Per-frame animation. `t` is the 0..1 progress of the 6 s teardown.
  useFrame(() => {
    const t = Math.max(0, Math.min(1, progressRef.current ?? 0));
    const timelineT = Math.max(0, Math.min(1, timelineRef?.current ?? t));

    // -------- LIFT (jump → HOVER → drop) on the whole rig --------
    // Behaviour:
    //   • timelineT < LIFT_UP_END   : jump up from the dust.
    //   • LIFT_UP_END..LIFT_DOWN_START : hold at peak altitude the
    //     whole time the body, mobility, and internal modules are
    //     blowing outward — the rover must NOT drop while the parts
    //     are still mid-flight.
    //   • timelineT >= LIFT_DOWN_START : land back onto the dust in the final
    //     sliver of the timeline so the rover settles after the last
    //     piece has finished moving.
    // The part animation uses a symmetric 0→1→0 progress value; lift
    // uses elapsed time so the midpoint cannot be mistaken for the end.
    const LIFT_HEIGHT = 1.1;
    const LIFT_UP_END = 0.08;
    const LIFT_DOWN_START = 0.92;
    const lift =
      timelineT < LIFT_UP_END
        ? smooth(timelineT / LIFT_UP_END) * LIFT_HEIGHT
        : timelineT < LIFT_DOWN_START
        ? LIFT_HEIGHT
        : smooth((1 - timelineT) / (1 - LIFT_DOWN_START)) * LIFT_HEIGHT;
    if (rootRef.current) {
      rootRef.current.position.y = modelConfig.basePosition[1] + lift;
    }
    if (occluderRef.current) {
      // Expand only the cheap broad-phase while parts are separated. The
      // second-stage ray test still uses the actual moving meshes, so empty
      // space inside the exploded assembly never becomes a dead zone.
      occluderRef.current.scale.setScalar(t > 0.03 ? 3.6 : 1);
    }

    // -------- External subsystems blow outward & rotate --------
    for (const g of semanticPartsRef.current) {
      const u = g.userData;
      const l = smooth(localT(t, u.start, u.end));
      g.position.set(
        u.original.x + u.explode.x * l,
        u.original.y + u.explode.y * l,
        u.original.z + u.explode.z * l,
      );
      g.rotation.set(u.rot.x * l, u.rot.y * l, u.rot.z * l);
    }

    // -------- Internal modules fade in then explode outward --------
    for (const g of internalsRef.current) {
      const u = g.userData;
      const l = smooth(localT(t, u.start, u.end));
      g.position.set(
        u.original.x + u.explode.x * l,
        u.original.y + u.explode.y * l,
        u.original.z + u.explode.z * l,
      );
      g.rotation.set(u.rot.x * l, u.rot.y * l, u.rot.z * l);

      // Fade in starting at max(0.46, start - 0.14), fully visible at
      // start + 0.10 — matches the original teardown's "body opens,
      // then internals become visible" timing.
      const fadeStart = Math.max(0.46, u.start - 0.14);
      const fadeEnd = u.start + 0.1;
      const fade = smooth(localT(t, fadeStart, fadeEnd));
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        if (Array.isArray(mat)) {
          for (const m of mat) {
            m.opacity = fade;
            m.depthWrite = fade > 0.7;
          }
        } else if (mat) {
          mat.opacity = fade;
          mat.depthWrite = fade > 0.7;
        }
        mesh.visible = fade > 0.01;
      });
    }
  });

  return (
    <group
      name="rover-model-rig"
      ref={rootRef}
      position={modelConfig.basePosition}
      rotation={[0, modelConfig.rotationY, 0]}
      scale={modelConfig.scale}
    >
      <mesh ref={occluderRef} name="rover-soil-occluder" position={[0, 1.05, 0]}>
        <boxGeometry args={[4.2, 2.5, 3.15]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  );
}
