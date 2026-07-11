'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_DUST = 1400;

const DUST_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vSeed;
  varying vec3 vColor;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(
      aSize * uPixelRatio * (520.0 / max(0.8, -mvPosition.z)),
      1.0,
      120.0 * uPixelRatio
    );
    vAlpha = aAlpha;
    vSeed = aSeed;
    vColor = aColor;
  }
`;

const DUST_FRAGMENT_SHADER = `
  varying float vAlpha;
  varying float vSeed;
  varying vec3 vColor;
  uniform float uTime;
  uniform vec3 uSunColor;
  uniform float uSunStrength;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32 + vSeed);
    return fract(point.x * point.y);
  }

  float noise21(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), fraction.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), fraction.x),
      fraction.y
    );
  }

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    float billow = noise21(gl_PointCoord * 3.2 + vec2(vSeed, uTime * 0.045));
    billow += noise21(gl_PointCoord * 7.1 - vec2(uTime * 0.025, vSeed)) * 0.45;
    float edge = 0.47 + (billow - 0.62) * 0.12;
    if (radius > edge) discard;
    float softParticle = 1.0 - smoothstep(0.05, edge, radius);
    float granularCore = 1.0 - smoothstep(0.0, 0.14 + billow * 0.05, radius);
    float alpha = vAlpha * (softParticle * (0.5 + billow * 0.46) + granularCore * 0.12);
    float illumination = clamp(uSunStrength, 0.0, 2.5);
    vec3 lightTint = mix(vec3(1.0, 0.72, 0.55), uSunColor, 0.45);
    vec3 litColor = vColor * lightTint * illumination;
    gl_FragColor = vec4(litColor, alpha * clamp(illumination, 0.0, 1.35));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type SurfaceMeta = {
  size: number;
  segments: number;
  baseHeights: Float32Array;
  deformations: Float32Array;
};

type SurfaceHit = {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
};

type PointerSample = {
  ndcX: number;
  ndcY: number;
  timestamp: number;
  inside: boolean;
  blocked: boolean;
  buttons: number;
};

type DustParticle = {
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  drag: number;
  gravity: number;
  baseSize: number;
  seed: number;
  color: THREE.Color;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function SoilInteraction({
  groundRef,
  sunColor,
  sunStrength,
}: {
  groundRef: RefObject<THREE.Mesh | null>;
  sunColor: string;
  sunStrength: number;
}) {
  const { camera, gl, raycaster, scene } = useThree();
  const dustRef = useRef<THREE.Points>(null);
  const roverOccluderRef = useRef<THREE.Object3D | null>(null);
  const roverRigRef = useRef<THREE.Object3D | null>(null);
  const pointer = useRef(new THREE.Vector2(2, 2));
  const pointerInside = useRef(false);
  const pointerBlocked = useRef(false);
  const pointerButtons = useRef(0);
  const pointerSamples = useRef<PointerSample[]>([]);
  const processedTimestamp = useRef(0);
  const lastPoint = useRef<THREE.Vector3 | null>(null);
  const lastNormal = useRef(new THREE.Vector3(0, 1, 0));
  const dustIndex = useRef(0);
  const surfaceActive = useRef(false);
  const surfaceDirty = useRef(false);
  const lastNormalUpdate = useRef(0);
  const motionEnergy = useRef(0);
  const dustBirthBudget = useRef(0);
  const dirtyBounds = useRef({
    minColumn: Number.POSITIVE_INFINITY,
    maxColumn: Number.NEGATIVE_INFINITY,
    minRow: Number.POSITIVE_INFINITY,
    maxRow: Number.NEGATIVE_INFINITY,
  });
  const previousCameraPosition = useRef(new THREE.Vector3());
  const previousCameraQuaternion = useRef(new THREE.Quaternion());
  const dustUniforms = useMemo(() => ({
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.65) },
    uTime: { value: 0 },
    uSunColor: { value: new THREE.Color('#ff8100') },
    uSunStrength: { value: 1 },
  }), []);
  const particles = useRef<DustParticle[]>(
    Array.from({ length: MAX_DUST }, (_, index) => ({
      life: 0,
      maxLife: 1,
      position: new THREE.Vector3(0, -999, 0),
      velocity: new THREE.Vector3(),
      drag: 2,
      gravity: 0.25,
      baseSize: 0.03,
      seed: index * 1.618,
      color: new THREE.Color('#8e321b'),
    })),
  );

  const dustGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_DUST * 3);
    const sizes = new Float32Array(MAX_DUST);
    const alphas = new Float32Array(MAX_DUST);
    const seeds = new Float32Array(MAX_DUST);
    const colors = new Float32Array(MAX_DUST * 3);
    positions.fill(-999);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    return geometry;
  }, []);

  useEffect(() => {
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const updatePointer = (event: PointerEvent) => {
      if (finePointer && !finePointer.matches) return;
      const bounds = gl.domElement.getBoundingClientRect();
      const blocked = event.target instanceof Element
        && Boolean(event.target.closest(
          'a, button, input, [role="button"], .mission-loader, .teardown-console, [aria-label="Solar calibration"], [data-page-footer]',
        ));
      const coalesced = typeof event.getCoalescedEvents === 'function'
        ? event.getCoalescedEvents()
        : [];
      const sourceEvents = coalesced.length > 0 ? [...coalesced, event] : [event];

      // PointerEvent coalescing is common on high-polling mice. Processing
      // only the final event once per frame creates gaps that feel like the
      // terrain has stopped seeing the cursor, so preserve the physical path.
      sourceEvents.forEach((sample, index) => {
        const previous = index > 0 ? sourceEvents[index - 1] : undefined;
        if (previous
          && sample.timeStamp === previous.timeStamp
          && sample.clientX === previous.clientX
          && sample.clientY === previous.clientY) return;
        const inside = sample.clientX >= bounds.left
          && sample.clientX <= bounds.right
          && sample.clientY >= bounds.top
          && sample.clientY <= bounds.bottom;
        pointerSamples.current.push({
          ndcX: ((sample.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
          ndcY: -((sample.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1,
          timestamp: sample.timeStamp,
          inside,
          blocked,
          buttons: sample.buttons,
        });
      });

      // This is a safety ceiling rather than a throttle: the retained first
      // sample is still connected to the previous world point, so even an OS
      // event burst produces one continuous trace rather than a cut.
      if (pointerSamples.current.length > 96) {
        pointerSamples.current.splice(0, pointerSamples.current.length - 96);
      }
      pointerInside.current = event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom;
      pointerBlocked.current = blocked;
      pointerButtons.current = event.buttons;
      pointer.current.set(
        ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
        -((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1,
      );
    };
    const leave = () => {
      pointerInside.current = false;
      pointerButtons.current = 0;
      pointerSamples.current.length = 0;
      lastPoint.current = null;
      processedTimestamp.current = 0;
      motionEnergy.current = 0;
      dustBirthBudget.current = 0;
      surfaceActive.current = false;
      document.querySelector('.mission-experience')?.removeAttribute('data-cursor-surface');
    };
    const release = () => {
      pointerButtons.current = 0;
      pointerSamples.current.length = 0;
      lastPoint.current = null;
      processedTimestamp.current = 0;
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', leave, { passive: true });
    window.addEventListener('blur', leave);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', leave);
      window.removeEventListener('blur', leave);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.querySelector('.mission-experience')?.removeAttribute('data-cursor-surface');
    };
  }, [gl]);

  useEffect(() => {
    const resize = () => {
      dustUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 1.65);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [dustUniforms]);

  useEffect(() => {
    dustUniforms.uSunColor.value.set(sunColor);
    dustUniforms.uSunStrength.value = sunStrength;
  }, [dustUniforms, sunColor, sunStrength]);

  const setSurfaceCursor = (active: boolean) => {
    if (surfaceActive.current === active) return;
    surfaceActive.current = active;
    const experience = document.querySelector('.mission-experience');
    if (active) experience?.setAttribute('data-cursor-surface', 'true');
    else experience?.removeAttribute('data-cursor-surface');
  };

  const intersectSurface = (ground: THREE.Mesh): SurfaceHit | undefined => {
    const geometry = ground.geometry as THREE.BufferGeometry;
    const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
    if (!meta) return undefined;
    ground.updateWorldMatrix(true, false);
    raycaster.setFromCamera(pointer.current, camera);

    const inverseWorld = ground.matrixWorld.clone().invert();
    const localOrigin = raycaster.ray.origin.clone().applyMatrix4(inverseWorld);
    const localDirection = raycaster.ray.direction.clone().transformDirection(inverseWorld);
    if (Math.abs(localDirection.z) < 0.00001) return undefined;

    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const spacing = meta.size / meta.segments;
    const half = meta.size / 2;
    const sampleTriangle = (x: number, y: number) => {
      const columnFloat = clamp((x + half) / spacing, 0, meta.segments);
      const rowFloat = clamp((half - y) / spacing, 0, meta.segments);
      const column = Math.min(meta.segments - 1, Math.floor(columnFloat));
      const row = Math.min(meta.segments - 1, Math.floor(rowFloat));
      const tx = columnFloat - column;
      const ty = rowFloat - row;
      const stride = meta.segments + 1;
      const topLeft = row * stride + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + stride;
      const bottomRight = bottomLeft + 1;
      return tx + ty <= 1
        ? {
          indices: [topLeft, topRight, bottomLeft] as const,
          weights: [1 - tx - ty, tx, ty] as const,
        }
        : {
          indices: [bottomRight, bottomLeft, topRight] as const,
          weights: [tx + ty - 1, 1 - tx, 1 - ty] as const,
        };
    };
    const sampleHeight = (x: number, y: number) => {
      const sample = sampleTriangle(x, y);
      return sample.indices.reduce(
        (height, index, sampleIndex) => height + position.getZ(index) * sample.weights[sampleIndex],
        0,
      );
    };

    let entry = 0;
    let exit = Number.POSITIVE_INFINITY;
    const clipAxis = (origin: number, direction: number, minimum: number, maximum: number) => {
      if (Math.abs(direction) < 0.000001) return origin >= minimum && origin <= maximum;
      let near = (minimum - origin) / direction;
      let far = (maximum - origin) / direction;
      if (near > far) [near, far] = [far, near];
      entry = Math.max(entry, near);
      exit = Math.min(exit, far);
      return exit >= entry;
    };
    const minimumSurfaceHeight = (geometry.boundingBox?.min.z ?? -3) - 0.24;
    const maximumSurfaceHeight = (geometry.boundingBox?.max.z ?? 4.5) + 0.12;
    if (!clipAxis(localOrigin.x, localDirection.x, -half, half)
      || !clipAxis(localOrigin.y, localDirection.y, -half, half)
      || !clipAxis(localOrigin.z, localDirection.z, minimumSurfaceHeight, maximumSurfaceHeight)
      || exit < 0) return undefined;
    entry = Math.max(0, entry);
    const marchLength = exit - entry;
    const marchSteps = Math.min(768, Math.max(32, Math.ceil(marchLength / (spacing * 0.55))));
    const localPoint = new THREE.Vector3();
    const surfaceDelta = (travel: number) => {
      localPoint.copy(localDirection).multiplyScalar(travel).add(localOrigin);
      return localPoint.z - sampleHeight(localPoint.x, localPoint.y);
    };
    let previousTravel = entry;
    let previousDelta = surfaceDelta(previousTravel);
    let lower = -1;
    let upper = -1;
    for (let step = 1; step <= marchSteps; step += 1) {
      const travel = THREE.MathUtils.lerp(entry, exit, step / marchSteps);
      const delta = surfaceDelta(travel);
      if (previousDelta >= 0 && delta <= 0) {
        lower = previousTravel;
        upper = travel;
        break;
      }
      previousTravel = travel;
      previousDelta = delta;
    }
    if (lower < 0) return undefined;
    for (let iteration = 0; iteration < 10; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (surfaceDelta(middle) > 0) lower = middle;
      else upper = middle;
    }
    const travel = (lower + upper) / 2;
    localPoint.copy(localDirection).multiplyScalar(travel).add(localOrigin);
    localPoint.z = sampleHeight(localPoint.x, localPoint.y);
    const interactionHalf = half - spacing * 0.5;
    if (Math.max(Math.abs(localPoint.x), Math.abs(localPoint.y)) > interactionHalf) return undefined;

    const surfaceSample = sampleTriangle(localPoint.x, localPoint.y);
    const localNormal = new THREE.Vector3();
    surfaceSample.indices.forEach((index, sampleIndex) => {
      localNormal.x += normal.getX(index) * surfaceSample.weights[sampleIndex];
      localNormal.y += normal.getY(index) * surfaceSample.weights[sampleIndex];
      localNormal.z += normal.getZ(index) * surfaceSample.weights[sampleIndex];
    });
    const worldPoint = ground.localToWorld(localPoint.clone());
    const worldNormal = localNormal.transformDirection(ground.matrixWorld).normalize();
    return {
      point: worldPoint,
      normal: worldNormal,
      distance: raycaster.ray.origin.distanceTo(worldPoint),
    };
  };

  const visibleSurfaceHit = (ground: THREE.Mesh) => {
    const surfaceHit = intersectSurface(ground);
    if (!surfaceHit) return undefined;
    if (!roverOccluderRef.current?.parent) {
      roverOccluderRef.current = scene.getObjectByName('rover-soil-occluder') ?? null;
    }
    if (!roverRigRef.current?.parent) {
      roverRigRef.current = scene.getObjectByName('rover-model-rig') ?? null;
    }
    const roverOccluder = roverOccluderRef.current;
    if (!roverOccluder) return surfaceHit;
    const broadHit = raycaster.intersectObject(roverOccluder, false)[0];
    if (!broadHit || broadHit.distance >= surfaceHit.distance) return surfaceHit;

    // The invisible box is only a cheap broad-phase. The old implementation
    // treated the whole box as solid and rejected valid ground between every
    // wheel. Inside that region, resolve against the real rendered meshes so
    // metal blocks the trace while visible gaps remain live soil.
    const roverRig = roverRigRef.current;
    if (!roverRig) return surfaceHit;
    const roverHit = raycaster.intersectObject(roverRig, true).find((intersection) => {
      if (intersection.object === roverOccluder
        || intersection.object.name === 'rover-soil-occluder'
        || !intersection.object.visible) return false;
      const material = (intersection.object as THREE.Mesh).material;
      const materials = Array.isArray(material) ? material : material ? [material] : [];
      return materials.length === 0 || materials.some((entry) => entry.visible && entry.opacity > 0.02);
    });
    return roverHit && roverHit.distance < surfaceHit.distance ? undefined : surfaceHit;
  };

  const deformSurface = (
    ground: THREE.Mesh,
    worldPoint: THREE.Vector3,
    worldDirection: THREE.Vector3,
    radius: number,
    pressure: number,
  ) => {
    const geometry = ground.geometry as THREE.BufferGeometry;
    const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
    if (!meta) return;
    const localPoint = ground.worldToLocal(worldPoint.clone());
    const surfaceSpacing = meta.size / meta.segments;
    const interactionHalf = meta.size / 2 - surfaceSpacing * 0.5;
    if (Math.max(Math.abs(localPoint.x), Math.abs(localPoint.y)) > interactionHalf) return;
    const contactRadius = Math.max(radius, surfaceSpacing * 1.85);

    const localDirectionEnd = ground.worldToLocal(worldPoint.clone().add(worldDirection));
    const localDirection = localDirectionEnd.sub(localPoint).setZ(0);
    const directionalContact = localDirection.lengthSq() > 0.000001;
    if (directionalContact) localDirection.normalize();
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const spacing = surfaceSpacing;
    const centerX = Math.round((localPoint.x + meta.size / 2) / spacing);
    const centerY = Math.round((meta.size / 2 - localPoint.y) / spacing);
    const reach = Math.ceil(contactRadius / spacing) + 1;

    for (let row = Math.max(0, centerY - reach); row <= Math.min(meta.segments, centerY + reach); row += 1) {
      for (let column = Math.max(0, centerX - reach); column <= Math.min(meta.segments, centerX + reach); column += 1) {
        const index = row * (meta.segments + 1) + column;
        const dx = position.getX(index) - localPoint.x;
        const dy = position.getY(index) - localPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > contactRadius) continue;
        const ratio = distance / contactRadius;
        const forward = (dx * localDirection.x + dy * localDirection.y) / contactRadius;
        const lateral = (-dx * localDirection.y + dy * localDirection.x) / contactRadius;
        const forwardFalloff = 1 - THREE.MathUtils.smoothstep(Math.abs(forward), 0.62, 1);
        const core = directionalContact
          ? Math.exp(-((lateral / 0.38) ** 2)) * forwardFalloff
          : Math.exp(-((ratio / 0.48) ** 2));
        // Soil dragged by a point contact forms two continuous berms beside
        // the groove. A full circular rim creates the artificial chain of
        // craters that a texture/decal approach produces, so the bank is
        // deliberately lateral to motion instead.
        const sideBank = directionalContact
          ? Math.exp(-(((Math.abs(lateral) - 0.72) / 0.14) ** 2)) * forwardFalloff
          : Math.exp(-(((ratio - 0.72) / 0.14) ** 2));
        const displacedBank = sideBank * pressure * 0.18;
        const compressedCenter = -pressure * core;
        meta.deformations[index] = clamp(
          meta.deformations[index] + compressedCenter + displacedBank,
          -0.2,
          0.075,
        );
        position.setZ(index, meta.baseHeights[index] + meta.deformations[index]);
        dirtyBounds.current.minColumn = Math.min(dirtyBounds.current.minColumn, column);
        dirtyBounds.current.maxColumn = Math.max(dirtyBounds.current.maxColumn, column);
        dirtyBounds.current.minRow = Math.min(dirtyBounds.current.minRow, row);
        dirtyBounds.current.maxRow = Math.max(dirtyBounds.current.maxRow, row);
      }
    }
    position.needsUpdate = true;
    surfaceDirty.current = true;
  };

  const emitDust = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    normal: THREE.Vector3,
    speed: number,
    sustainedEnergy: number,
    count: number,
  ) => {
    const kinetic = clamp(speed / 3.2, 0, 2.7);
    if (kinetic < 0.12) return;
    const pressureEnergy = 0.78;
    const side = new THREE.Vector3().crossVectors(normal, direction).normalize();

    for (let index = 0; index < count; index += 1) {
      let particle: DustParticle | undefined;
      for (let offset = 0; offset < MAX_DUST; offset += 1) {
        const candidateIndex = (dustIndex.current + offset) % MAX_DUST;
        const candidate = particles.current[candidateIndex];
        if (candidate.life > 0) continue;
        particle = candidate;
        dustIndex.current = (candidateIndex + 1) % MAX_DUST;
        break;
      }
      if (!particle) break;
      const coarseChance = clamp(
        0.025 + (kinetic - 0.7) * 0.2 + sustainedEnergy * 0.035,
        0.02,
        0.48,
      );
      const coarse = Math.random() < coarseChance;
      const launch = pressureEnergy * (0.35 + kinetic * 0.5 + sustainedEnergy * 0.12);
      particle.maxLife = coarse
        ? 0.58 + Math.random() * (0.62 + sustainedEnergy * 0.1)
        : 1.25 + Math.random() * (1.05 + kinetic * 0.42 + sustainedEnergy * 0.3);
      particle.life = particle.maxLife;
      particle.drag = coarse ? 0.7 + Math.random() * 0.45 : 0.82 + Math.random() * 0.7;
      particle.gravity = coarse ? 0.82 : 0.085;
      particle.baseSize = coarse
        ? 0.045 + Math.random() * (0.055 + kinetic * 0.018)
        : 0.13 + Math.random() * (0.16 + kinetic * 0.075 + sustainedEnergy * 0.045);
      particle.seed = Math.random() * 100;
      particle.color.set(coarse ? '#35100a' : Math.random() > 0.45 ? '#a94422' : '#6f2617');
      particle.position.copy(origin)
        .addScaledVector(side, (Math.random() - 0.5) * 0.13)
        .addScaledVector(normal, 0.022 + Math.random() * 0.04);
      particle.velocity.copy(direction).multiplyScalar((0.1 + Math.random() * 0.28) * kinetic * pressureEnergy)
        .addScaledVector(side, (Math.random() - 0.5) * 0.72 * launch)
        .addScaledVector(normal, coarse
          ? 0.12 + Math.random() * 0.62 * launch
          : 0.24 + Math.random() * 1.18 * launch);
    }
  };

  const disturbPath = (
    ground: THREE.Mesh,
    from: THREE.Vector3,
    to: THREE.Vector3,
    normal: THREE.Vector3,
    speed: number,
    elapsedSeconds: number,
  ) => {
    const distance = from.distanceTo(to);
    if (distance < 0.0005) return;
    const kinetic = clamp(speed / 3.2, 0.08, 2.7);
    const slowContact = 1 - THREE.MathUtils.smoothstep(kinetic, 0.14, 1.15);
    const radius = 0.205 + kinetic * 0.032;
    // A slow cursor dwells against the surface and compacts it more deeply.
    // Fast motion remains deep, but transfers more of its energy into dust.
    const basePressure = 0.0064 + slowContact * 0.0086 + kinetic * 0.0002;
    const spacing = 0.065;
    const steps = Math.max(1, Math.min(240, Math.ceil(distance / spacing)));
    const effectiveSpacing = distance / steps;
    const pressure = basePressure * clamp(effectiveSpacing / spacing, 1, 2.8);
    const direction = to.clone().sub(from).normalize();

    for (let step = 1; step <= steps; step += 1) {
      const point = from.clone().lerp(to, step / steps);
      deformSurface(ground, point, direction, radius, pressure);
    }

    // A sustainable birth reservoir lets sustained high-speed motion build a
    // dense plume without replacing every still-living particle each frame.
    const dustRate = 8
      + Math.pow(kinetic, 1.7) * 105
      + motionEnergy.current * 75;
    dustBirthBudget.current = Math.min(
      180,
      dustBirthBudget.current + dustRate * elapsedSeconds,
    );
    const births = Math.floor(dustBirthBudget.current);
    dustBirthBudget.current -= births;
    if (births <= 0) return;
    const dustSamples = Math.min(12, births);
    for (let sample = 1; sample <= dustSamples; sample += 1) {
      const point = from.clone().lerp(to, sample / dustSamples);
      const count = Math.floor(births / dustSamples) + (sample <= births % dustSamples ? 1 : 0);
      emitDust(point, direction, normal, speed, motionEnergy.current, count);
    }
  };

  useFrame((state, delta) => {
    const ground = groundRef.current;
    const samples = pointerSamples.current.splice(0, pointerSamples.current.length);
    const pointerMoved = samples.length > 0;
    const cameraMoved = previousCameraPosition.current.distanceToSquared(camera.position) > 0.000004
      || 1 - Math.abs(previousCameraQuaternion.current.dot(camera.quaternion)) > 0.000002;
    previousCameraPosition.current.copy(camera.position);
    previousCameraQuaternion.current.copy(camera.quaternion);
    motionEnergy.current = Math.max(0, motionEnergy.current - delta * 0.34);

    // Camera-only movement re-anchors the same screen-space contact without
    // disturbing soil. The next real pointer delta therefore never inherits
    // a stale world point, yet OrbitControls damping cannot break a stroke.
    if (cameraMoved && !pointerMoved) {
      if (ground && pointerInside.current && !pointerBlocked.current && pointerButtons.current === 0) {
        const reanchoredHit = visibleSurfaceHit(ground);
        lastPoint.current = reanchoredHit?.point.clone() ?? null;
        setSurfaceCursor(Boolean(reanchoredHit));
      } else {
        lastPoint.current = null;
      }
    }

    if (pointerMoved) {
      let latestHit: SurfaceHit | undefined;
      samples.forEach((sample) => {
        pointer.current.set(sample.ndcX, sample.ndcY);
        const elapsedMs = processedTimestamp.current > 0
          ? clamp(sample.timestamp - processedTimestamp.current, 2, 80)
          : 16;
        processedTimestamp.current = sample.timestamp;
        const canHit = Boolean(
          ground
          && sample.inside
          && !sample.blocked
          && sample.buttons === 0,
        );
        const hit = canHit && ground ? visibleSurfaceHit(ground) : undefined;
        latestHit = hit;

        if (hit && ground) {
          lastNormal.current.lerp(hit.normal, 0.42).normalize();
          if (lastPoint.current) {
            const distance = lastPoint.current.distanceTo(hit.point);
            const speed = distance / (elapsedMs / 1000);
            const kinetic = clamp(speed / 3.2, 0, 2.7);
            motionEnergy.current = clamp(
              motionEnergy.current + (elapsedMs / 1000) * (0.18 + kinetic * 1.3),
              0,
              2,
            );
            disturbPath(
              ground,
              lastPoint.current,
              hit.point,
              lastNormal.current,
              speed,
              elapsedMs / 1000,
            );
          } else {
            // A valid hover registers immediately. This first contact is deep
            // enough to read in grazing light while still remaining smaller
            // than a slow, sustained trace.
            deformSurface(ground, hit.point, new THREE.Vector3(), 0.18, 0.0075);
          }
          lastPoint.current = hit.point.clone();
        } else {
          lastPoint.current = null;
        }
      });
      setSurfaceCursor(Boolean(latestHit));
    }

    if (surfaceDirty.current && ground && state.clock.elapsedTime - lastNormalUpdate.current > 0.055) {
      const geometry = ground.geometry as THREE.BufferGeometry;
      const meta = geometry.userData.surfaceMeta as SurfaceMeta | undefined;
      const position = geometry.getAttribute('position') as THREE.BufferAttribute;
      const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
      const bounds = dirtyBounds.current;
      if (meta && Number.isFinite(bounds.minColumn)) {
        const stride = meta.segments + 1;
        const spacing = meta.size / meta.segments;
        const minColumn = Math.max(0, bounds.minColumn - 1);
        const maxColumn = Math.min(meta.segments, bounds.maxColumn + 1);
        const minRow = Math.max(0, bounds.minRow - 1);
        const maxRow = Math.min(meta.segments, bounds.maxRow + 1);

        for (let row = minRow; row <= maxRow; row += 1) {
          for (let column = minColumn; column <= maxColumn; column += 1) {
            const index = row * stride + column;
            const left = row * stride + Math.max(0, column - 1);
            const right = row * stride + Math.min(meta.segments, column + 1);
            const up = Math.max(0, row - 1) * stride + column;
            const down = Math.min(meta.segments, row + 1) * stride + column;
            const dxScale = column === 0 || column === meta.segments ? spacing : spacing * 2;
            const dyScale = row === 0 || row === meta.segments ? spacing : spacing * 2;
            const slopeX = (position.getZ(right) - position.getZ(left)) / dxScale;
            const slopeY = (position.getZ(up) - position.getZ(down)) / dyScale;
            const inverseLength = 1 / Math.sqrt(slopeX * slopeX + slopeY * slopeY + 1);
            normal.setXYZ(
              index,
              -slopeX * inverseLength,
              -slopeY * inverseLength,
              inverseLength,
            );
          }
        }
        normal.needsUpdate = true;
      }
      dirtyBounds.current = {
        minColumn: Number.POSITIVE_INFINITY,
        maxColumn: Number.NEGATIVE_INFINITY,
        minRow: Number.POSITIVE_INFINITY,
        maxRow: Number.NEGATIVE_INFINITY,
      };
      surfaceDirty.current = false;
      lastNormalUpdate.current = state.clock.elapsedTime;
    }

    const positions = dustGeometry.getAttribute('position') as THREE.BufferAttribute;
    const sizes = dustGeometry.getAttribute('aSize') as THREE.BufferAttribute;
    const alphas = dustGeometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const seeds = dustGeometry.getAttribute('aSeed') as THREE.BufferAttribute;
    const colors = dustGeometry.getAttribute('aColor') as THREE.BufferAttribute;
    const frameStep = Math.min(delta, 0.04);
    dustUniforms.uTime.value = state.clock.elapsedTime;

    particles.current.forEach((particle, index) => {
      if (particle.life <= 0) {
        positions.setXYZ(index, 0, -999, 0);
        sizes.setX(index, 0);
        alphas.setX(index, 0);
        return;
      }
      particle.life -= frameStep;
      const turbulence = Math.sin(state.clock.elapsedTime * 5.1 + particle.seed) * 0.024;
      particle.velocity.x += (0.045 + turbulence) * frameStep;
      particle.velocity.z += (-0.014 + turbulence * 0.45) * frameStep;
      particle.velocity.y -= particle.gravity * frameStep;
      particle.velocity.multiplyScalar(Math.exp(-particle.drag * frameStep));
      particle.position.addScaledVector(particle.velocity, frameStep);
      const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
      const bloom = Math.sin((1 - lifeRatio) * Math.PI);
      positions.setXYZ(index, particle.position.x, particle.position.y, particle.position.z);
      sizes.setX(index, particle.baseSize * (0.72 + bloom * 2.55));
      alphas.setX(index, Math.min(0.58, lifeRatio * (0.16 + bloom * 0.46)));
      seeds.setX(index, particle.seed);
      colors.setXYZ(index, particle.color.r, particle.color.g, particle.color.b);
    });
    positions.needsUpdate = true;
    sizes.needsUpdate = true;
    alphas.needsUpdate = true;
    seeds.needsUpdate = true;
    colors.needsUpdate = true;
  });

  return (
    <points ref={dustRef} geometry={dustGeometry} frustumCulled={false} renderOrder={8}>
      <shaderMaterial
        uniforms={dustUniforms}
        vertexShader={DUST_VERTEX_SHADER}
        fragmentShader={DUST_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

export default SoilInteraction;
