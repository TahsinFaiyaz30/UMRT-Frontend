'use client';

/**
 * DismantleScene — React Three Fiber component that renders the
 * semantic teardown of the Curiosity rover model.
 *
 * Ported from the vanilla Three.js implementation in
 * curiosity_semantic_real_teardown/index.html, re-written as
 * declarative R3F with imperative animation via useFrame.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import {
  teardownCenter,
  teardownMotions,
  internalModules,
  materialPalette,
  smooth,
  localT,
  clampT,
  type InternalModuleDef,
  type MaterialDef,
} from '@/lib/teardownConfig';

/* ------------------------------------------------------------------ */
/*  Material factory                                                   */
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
/*  Procedural internal geometry builders                               */
/* ------------------------------------------------------------------ */

function addBox(
  parent: THREE.Group,
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
  parent: THREE.Group,
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
  parent: THREE.Group,
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
  parent: THREE.Group,
  pos: [number, number, number],
  size: [number, number, number] = [0.40, 0.035, 0.28],
  chips = 5,
  mats: Record<string, THREE.MeshStandardMaterial>,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);

  addBox(g, [0, 0, 0], size, mats.pcb);

  // traces
  for (let i = 0; i < 10; i++) {
    addBox(
      g,
      [-size[0] * 0.2 + (i % 3) * 0.08, size[1] / 2 + 0.006, -size[2] * 0.42 + i * size[2] * 0.08],
      [size[0] * 0.52, 0.006, 0.006],
      mats.copper,
    );
  }

  // chips + pins
  for (let i = 0; i < chips; i++) {
    const x = (i % 3 - 1) * size[0] * 0.22;
    const z = (Math.floor(i / 3) - 0.5) * size[2] * 0.28;
    addBox(g, [x, size[1] / 2 + 0.028, z], [size[0] * 0.15, 0.045, size[2] * 0.13], mats.chip);
    for (let p = 0; p < 6; p++) {
      addBox(g, [x - size[0] * 0.09, size[1] / 2 + 0.034, z + (p - 2.5) * size[2] * 0.018], [0.014, 0.01, 0.004], mats.metal);
      addBox(g, [x + size[0] * 0.09, size[1] / 2 + 0.034, z + (p - 2.5) * size[2] * 0.018], [0.014, 0.01, 0.004], mats.metal);
    }
  }

  // capacitors
  for (let i = 0; i < 6; i++) {
    addCylinder(
      g,
      [-size[0] * 0.38 + (i % 3) * size[0] * 0.32, size[1] / 2 + 0.04, -size[2] * 0.3 + Math.floor(i / 3) * size[2] * 0.25],
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
/*  Build all procedural internal modules                              */
/* ------------------------------------------------------------------ */

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

function buildAllInternals(mats: Record<string, THREE.MeshStandardMaterial>): InternalGroup[] {
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

  // SAM suite
  const sam = makeGroup(internalModules[0]);
  addBox(sam, [-0.40, 0.92, 0.48], [0.035, 0.09, 0.50], mats.metal);
  addBox(sam, [-0.05, 0.92, 0.48], [0.035, 0.09, 0.50], mats.metal);
  addCylinder(sam, [-0.23, 1.00, 0.25], 0.11, 0.035, mats.gold, 'y', 32);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    addCylinder(sam, [-0.23 + Math.cos(a) * 0.075, 1.03, 0.25 + Math.sin(a) * 0.075], 0.016, 0.035, mats.darkMetal, 'y', 12);
  }
  // helical tubing
  let prev: [number, number, number] | null = null;
  for (let i = 0; i < 70; i++) {
    const t = (i / 69) * Math.PI * 7;
    const p: [number, number, number] = [-0.33 + Math.cos(t) * 0.075, 1.10 + (i / 69) * 0.14, 0.61 + Math.sin(t) * 0.075];
    if (prev) addRod(sam, prev, p, 0.006, mats.copper);
    prev = p;
  }
  addCylinder(sam, [-0.10, 1.08, 0.42], 0.055, 0.22, mats.darkMetal, 'z', 24);
  addBox(sam, [-0.15, 1.15, 0.72], [0.26, 0.05, 0.12], mats.blue);
  addPCB(sam, [-0.30, 1.16, 0.38], [0.32, 0.025, 0.20], 4, mats);

  // CheMin
  const chemin = makeGroup(internalModules[1]);
  addBox(chemin, [0.25, 0.88, 0.42], [0.42, 0.045, 0.42], mats.white);
  addCylinder(chemin, [0.25, 1.06, 0.42], 0.12, 0.025, mats.darkMetal, 'y', 36);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addCylinder(chemin, [0.25 + Math.cos(a) * 0.075, 1.09, 0.42 + Math.sin(a) * 0.075], 0.014, 0.025, mats.gold, 'y', 12);
  }
  addRod(chemin, [0.05, 1.13, 0.28], [0.19, 1.08, 0.38], 0.025, mats.blue);
  addBox(chemin, [0.42, 1.10, 0.55], [0.11, 0.035, 0.16], mats.cyan);
  addPCB(chemin, [0.25, 1.18, 0.17], [0.30, 0.025, 0.18], 3, mats);

  // Avionics
  const avionics = makeGroup(internalModules[2]);
  addPCB(avionics, [-0.28, 1.08, -0.20], [0.40, 0.035, 0.30], 6, mats);
  addPCB(avionics, [0.28, 1.08, -0.20], [0.40, 0.035, 0.30], 6, mats);
  addBox(avionics, [-0.28, 1.15, -0.20], [0.12, 0.018, 0.10], mats.metal);
  addBox(avionics, [0.28, 1.15, -0.20], [0.12, 0.018, 0.10], mats.metal);

  // Power / batteries / radios
  const power = makeGroup(internalModules[3]);
  addPCB(power, [0.0, 0.82, -0.58], [0.50, 0.035, 0.30], 4, mats);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      addCylinder(power, [side * 0.50, 0.86, -0.40 + i * 0.12], 0.035, 0.18, mats.blue, 'y', 18);
    }
  }
  addPCB(power, [-0.44, 1.12, -0.76], [0.26, 0.025, 0.20], 3, mats);
  addPCB(power, [0.44, 1.12, -0.76], [0.26, 0.025, 0.20], 3, mats);

  // Wiring harness
  const wires = makeGroup(internalModules[4]);
  for (let i = 0; i < 6; i++) {
    addRod(wires, [-0.30 + i * 0.015, 1.08, 0.40], [0.0 + i * 0.015, 0.86, -0.50], 0.006, i % 2 ? mats.gold : mats.copper);
  }
  for (let i = 0; i < 6; i++) {
    addRod(wires, [0.30 - i * 0.015, 1.08, 0.34], [0.0 - i * 0.015, 0.86, -0.50], 0.006, i % 2 ? mats.cyan : mats.copper);
  }

  // Make internal meshes start transparent / invisible
  for (const g of groups) {
    g.userData.original.copy(g.position);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        mat.transparent = true;
        mat.opacity = 0;
        mat.depthWrite = false;
        mesh.material = mat;
      }
    });
  }

  return groups;
}

/* ------------------------------------------------------------------ */
/*  Dust particles                                                     */
/* ------------------------------------------------------------------ */

function DustParticles() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < 320; i++) {
      positions.push((Math.random() - 0.5) * 28, Math.random() * 12 - 1, -8 - Math.random() * 16);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);

  return (
    <points geometry={geo}>
      <pointsMaterial color={0xffffff} size={0.014} transparent opacity={0.3} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Main DismantleScene component                                      */
/* ------------------------------------------------------------------ */

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

export function DismantleScene({
  progressRef,
}: {
  progressRef: React.RefObject<number>;
}) {
  const { scene } = useThree();

  // Refs that persist across renders
  const semanticPartsRef = useRef<SemanticGroup[]>([]);
  const internalsRef = useRef<InternalGroup[]>([]);
  const sceneGroupRef = useRef<THREE.Group | null>(null);
  const smoothProgress = useRef(0);
  const initializedRef = useRef(false);

  // Create materials once
  const mats = useMemo(() => {
    const m: Record<string, THREE.MeshStandardMaterial> = {};
    for (const [key, def] of Object.entries(materialPalette)) {
      m[key] = makeMat(def);
    }
    return m;
  }, []);

  // Load the teardown GLB
  const gltf = useGLTF('/models/curiosity_v4_semantic_external.glb');

  // Initialize: group meshes by subsystem label + build internals
  useEffect(() => {
    if (initializedRef.current || !gltf?.scene || !sceneGroupRef.current) return;
    initializedRef.current = true;

    const rootGroup = sceneGroupRef.current;
    const labelGroups: Record<string, SemanticGroup> = {};
    const semParts: SemanticGroup[] = [];

    // Clone the GLTF scene so we don't mutate the cached version
    const clonedScene = gltf.scene.clone(true);

    // IMPORTANT: Collect meshes first, then re-parent AFTER traversal.
    // Re-parenting during traverse mutates the children array mid-iteration,
    // causing 'Cannot read properties of undefined' errors.
    const collected: { mesh: THREE.Mesh; label: string }[] = [];

    clonedScene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const mesh = o as THREE.Mesh;
      mesh.frustumCulled = false;

      const label = mesh.name.split('__')[0];
      const motion = teardownMotions[label];
      if (!motion) return;

      // Boost env map intensity on existing materials
      if (mesh.material) {
        const matArr = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of matArr) {
          if ((mat as THREE.MeshStandardMaterial).envMapIntensity !== undefined) {
            (mat as THREE.MeshStandardMaterial).envMapIntensity = 1.2;
            mat.needsUpdate = true;
          }
        }
      }

      collected.push({ mesh, label });
    });

    // Now re-parent meshes into semantic groups (safe — traversal is done)
    for (const { mesh, label } of collected) {
      if (!labelGroups[label]) {
        const motion = teardownMotions[label];
        const g = new THREE.Group() as SemanticGroup;
        g.userData = {
          label,
          original: new THREE.Vector3(),
          explode: new THREE.Vector3(...motion.explode),
          rot: new THREE.Euler(...motion.rot),
          start: motion.start,
          end: motion.end,
        };
        rootGroup.add(g);
        labelGroups[label] = g;
        semParts.push(g);
      }
      labelGroups[label].add(mesh);
    }

    // Record original positions
    for (const g of semParts) {
      g.userData.original.copy(g.position);
    }
    semanticPartsRef.current = semParts;

    // Build procedural internals
    const internalGroups = buildAllInternals(mats);
    for (const g of internalGroups) {
      rootGroup.add(g);
    }
    internalsRef.current = internalGroups;
  }, [gltf, mats]);

  // Animation loop: apply teardown based on progress
  useFrame(() => {
    const target = clampT(progressRef.current ?? 0);

    // Smooth interpolation toward target
    smoothProgress.current += (target - smoothProgress.current) * 0.10;
    if (Math.abs(smoothProgress.current - target) < 0.0005) {
      smoothProgress.current = target;
    }

    const t = smoothProgress.current;

    // Apply to semantic parts (external)
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

    // Apply to internal modules
    for (const g of internalsRef.current) {
      const u = g.userData;
      const l = smooth(localT(t, u.start, u.end));
      g.position.set(
        u.original.x + u.explode.x * l,
        u.original.y + u.explode.y * l,
        u.original.z + u.explode.z * l,
      );
      g.rotation.set(u.rot.x * l, u.rot.y * l, u.rot.z * l);

      // Fade in internal meshes as body opens
      const fade = smooth(localT(t, Math.max(0.46, u.start - 0.14), u.start + 0.10));
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.opacity = fade;
          mat.depthWrite = fade > 0.7;
          mesh.visible = fade > 0.01;
        }
      });
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 7, 5]} intensity={1.8} />
      <directionalLight position={[-6, 4, -5]} intensity={1.0} color={0x9bdcff} />
      <pointLight position={[0, -1.3, 4]} intensity={2.5} distance={20} color={0xff6a20} />

      {/* Environment for PBR reflections */}
      <Environment preset="city" />

      {/* Scene fog */}
      <fog attach="fog" args={[0x050814, 7, 26]} />
      <color attach="background" args={['#050814']} />

      {/* Dust particles */}
      <DustParticles />

      {/* Orbit controls — 360° rotation with auto-rotate */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableRotate
        enableZoom
        autoRotate
        autoRotateSpeed={0.8}
        target={teardownCenter}
        minDistance={2}
        maxDistance={18}
      />

      {/* The group that holds all semantic parts + internals */}
      <group ref={sceneGroupRef} />
    </>
  );
}

// NOTE: useGLTF.preload is intentionally NOT called here. Preloading
// kicks off a parallel network fetch of the 7 MB GLB at JS-load time,
// before the browser has even painted. That was the real cause of the
// "page isn't responding" warning on first load. The fetch now happens
// only when DismantleSection's IntersectionObserver fires.
