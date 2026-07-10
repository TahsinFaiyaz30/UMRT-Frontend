'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_DUST = 640;

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
    gl_PointSize = clamp(aSize * uPixelRatio * (520.0 / max(0.8, -mvPosition.z)), 1.0, 96.0);
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
    gl_FragColor = vec4(vColor, alpha);
  }
`;

type SurfaceMeta = {
  size: number;
  segments: number;
  baseHeights: Float32Array;
  deformations: Float32Array;
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

export function SoilInteraction({ groundRef }: { groundRef: RefObject<THREE.Mesh | null> }) {
  const { camera, gl, raycaster } = useThree();
  const dustRef = useRef<THREE.Points>(null);
  const pointer = useRef(new THREE.Vector2(2, 2));
  const pointerInside = useRef(false);
  const pointerBlocked = useRef(false);
  const pointerRevision = useRef(0);
  const processedRevision = useRef(-1);
  const pointerTimestamp = useRef(0);
  const processedTimestamp = useRef(0);
  const lastPoint = useRef<THREE.Vector3 | null>(null);
  const lastNormal = useRef(new THREE.Vector3(0, 1, 0));
  const dustIndex = useRef(0);
  const surfaceActive = useRef(false);
  const surfaceDirty = useRef(false);
  const lastNormalUpdate = useRef(0);
  const motionEnergy = useRef(0);
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
      pointerInside.current = event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom;
      pointerBlocked.current = event.target instanceof Element
        && Boolean(event.target.closest('a, button, input, [role="button"]'));
      pointer.current.set(
        ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
        -((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1,
      );
      pointerTimestamp.current = event.timeStamp;
      pointerRevision.current += 1;
    };
    const leave = () => {
      pointerInside.current = false;
      lastPoint.current = null;
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', updatePointer);
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

  const setSurfaceCursor = (active: boolean) => {
    if (surfaceActive.current === active) return;
    surfaceActive.current = active;
    const experience = document.querySelector('.mission-experience');
    if (active) experience?.setAttribute('data-cursor-surface', 'true');
    else experience?.removeAttribute('data-cursor-surface');
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
    if (Math.max(Math.abs(localPoint.x), Math.abs(localPoint.y)) > meta.size * 0.455) return;

    const localDirectionEnd = ground.worldToLocal(worldPoint.clone().add(worldDirection));
    const localDirection = localDirectionEnd.sub(localPoint).setZ(0).normalize();
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const spacing = meta.size / meta.segments;
    const centerX = Math.round((localPoint.x + meta.size / 2) / spacing);
    const centerY = Math.round((meta.size / 2 - localPoint.y) / spacing);
    const reach = Math.ceil(radius / spacing) + 1;

    for (let row = Math.max(0, centerY - reach); row <= Math.min(meta.segments, centerY + reach); row += 1) {
      for (let column = Math.max(0, centerX - reach); column <= Math.min(meta.segments, centerX + reach); column += 1) {
        const index = row * (meta.segments + 1) + column;
        const dx = position.getX(index) - localPoint.x;
        const dy = position.getY(index) - localPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > radius) continue;
        const forward = (dx * localDirection.x + dy * localDirection.y) / radius;
        const lateral = (-dx * localDirection.y + dy * localDirection.x) / radius;
        const forwardFalloff = 1 - THREE.MathUtils.smoothstep(Math.abs(forward), 0.62, 1);
        const core = Math.exp(-((lateral / 0.38) ** 2)) * forwardFalloff;
        // Soil dragged by a point contact forms two continuous berms beside
        // the groove. A full circular rim creates the artificial chain of
        // craters that a texture/decal approach produces, so the bank is
        // deliberately lateral to motion instead.
        const sideBank = Math.exp(-(((Math.abs(lateral) - 0.72) / 0.14) ** 2)) * forwardFalloff;
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
  ) => {
    const kinetic = clamp(speed / 3.2, 0, 2.7);
    if (kinetic < 0.12) return;
    const durationBoost = 1 + clamp(sustainedEnergy, 0, 2) * 0.42;
    const pressureEnergy = 0.78;
    const emission = Math.min(48, Math.max(
      1,
      Math.round((1 + Math.pow(kinetic, 1.52) * 8.6) * pressureEnergy * durationBoost),
    ));
    const side = new THREE.Vector3().crossVectors(normal, direction).normalize();

    for (let index = 0; index < emission; index += 1) {
      const particle = particles.current[dustIndex.current];
      dustIndex.current = (dustIndex.current + 1) % MAX_DUST;
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
  ) => {
    const distance = from.distanceTo(to);
    if (distance < 0.0005) return;
    const kinetic = clamp(speed / 3.2, 0.08, 2.7);
    const slowContact = 1 - THREE.MathUtils.smoothstep(kinetic, 0.14, 1.15);
    const radius = 0.205 + kinetic * 0.032;
    // A slow cursor dwells against the surface and compacts it more deeply.
    // Fast motion remains deep, but transfers more of its energy into dust.
    const pressure = 0.0072 + slowContact * 0.0062 + kinetic * 0.00082;
    const spacing = 0.05;
    const steps = Math.max(1, Math.min(96, Math.ceil(distance / spacing)));
    const direction = to.clone().sub(from).normalize();

    for (let step = 1; step <= steps; step += 1) {
      const point = from.clone().lerp(to, step / steps);
      deformSurface(ground, point, direction, radius, pressure);
    }

    // Deformation needs many close samples; the airborne plume does not. A
    // small number of energetic launch sites avoids overwriting the particle
    // pool while still making long, fast sweeps produce a broad cloud.
    const dustSamples = Math.min(10, Math.max(
      2,
      Math.ceil(2 + kinetic * 1.8 + motionEnergy.current * 1.5),
    ));
    for (let sample = 1; sample <= dustSamples; sample += 1) {
      const point = from.clone().lerp(to, sample / dustSamples);
      emitDust(point, direction, normal, speed, motionEnergy.current);
    }
  };

  useFrame((state, delta) => {
    const ground = groundRef.current;
    const pointerMoved = processedRevision.current !== pointerRevision.current;
    const cameraMoved = previousCameraPosition.current.distanceToSquared(camera.position) > 0.000004
      || 1 - Math.abs(previousCameraQuaternion.current.dot(camera.quaternion)) > 0.000002;
    // Reset a stale world-space contact when the scroll/orbit camera moves on
    // its own. If the pointer also moved, its fresh sample takes precedence.
    if (cameraMoved && !pointerMoved) lastPoint.current = null;
    previousCameraPosition.current.copy(camera.position);
    previousCameraQuaternion.current.copy(camera.quaternion);
    motionEnergy.current = Math.max(0, motionEnergy.current - delta * 0.34);

    if (pointerMoved) {
      processedRevision.current = pointerRevision.current;
      const elapsedMs = processedTimestamp.current > 0
        ? Math.max(8, pointerTimestamp.current - processedTimestamp.current)
        : 16;
      processedTimestamp.current = pointerTimestamp.current;
      const canHit = Boolean(ground && pointerInside.current && !pointerBlocked.current);
      let hit: THREE.Intersection<THREE.Object3D> | undefined;
      if (canHit && ground) {
        raycaster.setFromCamera(pointer.current, camera);
        hit = raycaster.intersectObject(ground, false)[0];
      }
      setSurfaceCursor(Boolean(hit));

      if (hit?.face && ground) {
        const normal = hit.face.normal.clone().transformDirection(ground.matrixWorld).normalize();
        lastNormal.current.lerp(normal, 0.42).normalize();
        if (lastPoint.current) {
          const distance = lastPoint.current.distanceTo(hit.point);
          const speed = distance / (elapsedMs / 1000);
          const kinetic = clamp(speed / 3.2, 0, 2.7);
          motionEnergy.current = clamp(
            motionEnergy.current + (elapsedMs / 1000) * (0.18 + kinetic * 1.3),
            0,
            2,
          );
          disturbPath(ground, lastPoint.current, hit.point, lastNormal.current, speed);
        } else {
          // The first surface sample leaves a small physical contact instead
          // of requiring a second pointer event before anything registers.
          deformSurface(ground, hit.point, new THREE.Vector3(1, 0, 0), 0.16, 0.0035);
        }
        lastPoint.current = hit.point.clone();
      } else {
        lastPoint.current = null;
      }
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
        toneMapped={false}
      />
    </points>
  );
}

export default SoilInteraction;
