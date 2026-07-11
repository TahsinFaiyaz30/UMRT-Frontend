# Cosmic Realism Upgrade — Work in Progress

Last updated: 2026-07-11  
Workspace: `UMRT-Frontend`  
Branch: `experimental-ui-redesign`  
Saved baseline commit: `90cceeb` — `Redesign achievements archive to cosmic multiverse theme`

## The goal

Resume the Achievements page realism pass and do not stop at a technically 3D or stylized result. The scene must look physically believable, sophisticated, and cinematic from every viewing angle.

The current multiverse foundation is functional, but the planets, suns/stars, lighting, and space materials still read as procedural demo graphics. The next pass must correct the physics, geometry, material depth, lighting, scale, and composition.

### Non-negotiable visual direction

- Do not make planets look like colored spheres with flat images wrapped around them.
- Use genuinely displaced, high-density 3D surface geometry. Craters, rims, ridges, faults, rocks, and macro elevation must affect the silhouette, normals, lighting, and shadows.
- A generated image may be used only as geological reference/material data. It must drive real height, normal, roughness, and albedo information rather than supply painted lighting.
- Lighting must be star-relative and physically coherent. Planet terminators, specular response, atmospheric glow, moons, and rings must react to the actual star position.
- Stars must not look like emissive icosahedrons. They need animated granulation, limb darkening, corona, restrained flares, believable color temperature, and controlled bloom.
- Atmospheres should use a Rayleigh/Mie-style approximation with a sunward limb and night-side falloff.
- Rings must be particulate 3D structures, not a single transparent flat ring.
- Asteroids and debris must have irregular geometry, varied scale/materials, believable orbital distribution, and light/shadow response.
- Nebulae and dust should have real depth and layered volumetric movement, without flat stretched sprites dominating the frame.
- Post-processing must be restrained: selective bloom for luminous objects, useful ambient occlusion, physical exposure/tone mapping, and no global blur or cheap glow.
- Preserve the unique eight-system scroll journey, achievement content, accessibility, mobile layout, reduced-motion mode, and shared footer.

## What is already safely saved

Commit `90cceeb` contains the completed foundation:

- Eight separate planetary systems across a deep 158-unit camera corridor.
- Seven portal/nebula transitions and scroll-driven camera travel.
- No rover model or rover GLB on the Achievements route.
- WebGL achievement monuments with real `TextGeometry`; no Drei `Html` card faces.
- Responsive portrait/tablet framing, keyboard milestone navigation, visible mobile years, reduced-motion behavior, and WebGL fallback.
- Star-relative day/night lighting foundation for planets and moons.
- The same canonical animated `SiteFooter` on Home and Achievements.
- Landing-page soil deformation/dust hardening, exact surface contacts, solar-aware dust color, and 3D ballistic grains.
- Rover GLB preload scoped to Home only.

Before this new realism pass started, type checking, linting, whitespace checks, and the production build were passing.

## New asset generated for the realism pass

Project asset:

`public/textures/cosmic/volcanic-basalt-albedo.png`

- Size: 1774 × 887 PNG, sRGB, 3 channels.
- Generated with the built-in image-generation workflow as a neutral, shadow-free geological reference.
- Content: volcanic basalt plates, iron-oxide ridges, cooled flows, mineral deposits, crater ejecta, and restrained magma fissures.
- It is intentionally not a finished planet skin.
- It is currently untracked and must be kept with this WIP when work resumes.

The generated reference should be converted into a real material set:

- seamless/tile-safe material source;
- linear height/displacement map;
- tangent-space normal map;
- physically plausible roughness map;
- optional cavity/ambient-occlusion map;
- color-managed albedo without baked highlights or shadows.

`sharp` is already available in `node_modules` and can be used by a reproducible Node material-build script.

## Work that was started and then intentionally stopped

Two parallel realism agents were launched and then interrupted when this work was paused:

1. `physical_cosmic_bodies`
   - Intended ownership: `CosmicUniverse.tsx` and `cosmicArchiveConfig.ts`.
   - Goal: displaced planetary geometry, PBR materials, atmospheres, particulate rings, realistic asteroids, stellar granulation, and volumetric nebulae.

2. `cinematic_cosmic_renderer`
   - Intended ownership: `HelixGallery3D.tsx` plus an optional post-processing helper.
   - Goal: physical exposure, fog/depth, improved monument materials/geometry, shadows, selective bloom, ambient occlusion, and quality-tier fallbacks.

Both were stopped before they changed tracked source files. At the pause point, `git status --short` showed only the new `public/textures/cosmic/` asset as untracked.

The planned intro-specific agent was not successfully started and made no changes.

## Recommended implementation order

### 1. Build the real material maps

Create a reproducible script such as `scripts/build-cosmic-materials.mjs` using `sharp`.

- Normalize and color-manage the generated reference.
- Create seamless source sampling suitable for triplanar projection.
- Derive a clean macro height field without treating baked color as literal height everywhere.
- Calculate Sobel/Scharr normal maps from the height field.
- Generate high, varied roughness appropriate for rock, ash, ice, mineral crust, and cooled lava.
- Keep outputs under `public/textures/cosmic/`.

### 2. Rebuild the planet and moon geometry

Primary files:

- `components/achievements/CosmicUniverse.tsx`
- `components/achievements/cosmicArchiveConfig.ts`

Implementation target:

- Quality-tier `IcosahedronGeometry` or another near-uniform spherical mesh.
- Real vertex displacement from macro material height plus seeded geological functions.
- Multiple deterministic crater bowls with raised rims and ejecta deformation.
- Domain-warped ridges, faults, weathering, ice shelves, sediment bands, and volcanic provinces depending on planet type.
- Fragment-level micro-normal and roughness variation layered over the real macro geometry.
- PBR/GGX response or a carefully extended `MeshPhysicalMaterial` so shadows and scene lights remain correct.
- Axial spin separate from orbital motion.
- Proper inverse-square falloff and star-relative terminators.
- Quality/visibility LOD so only nearby systems use the highest geometry/material cost.

### 3. Rebuild stars and surrounding matter

- Replace the geometric star core with a smooth sphere and surface shader.
- Use multi-scale convective/granulation noise, limb darkening, restrained prominences, a corona shell, and temperature-based color.
- Keep bloom selective and small; the star must retain a visible core.
- Build rings from instanced rock/ice particles with density bands and shepherd gaps.
- Improve asteroid belts with several shared irregular geometries, per-instance material color, spin, and orbital thickness.
- Use layered volumetric nebula/dust fields with depth-aware fading instead of large stretched flat clouds.

### 4. Add a controlled cinematic render pipeline

Primary file:

`components/achievements/HelixGallery3D.tsx`

Possible helper:

`components/achievements/CosmicPostProcessing.tsx`

- Preserve ACES filmic tone mapping and calibrate exposure per scene.
- Add subtle selective `UnrealBloomPass` for genuinely emissive stars/signals.
- Add stable ambient occlusion only where it materially improves monument/asteroid depth.
- Correct shadow map bias, camera near/far planes, fog/depth, and resize/disposal behavior.
- Improve achievement monuments with bevels, panel recesses, fasteners, layered metal/ceramic/glass, and believable roughness rather than flat boxes.
- Keep all meaningful text readable and in WebGL geometry.

### 5. Retune the opening composition

Primary file:

`components/achievements/CosmicIntroUniverse.tsx`

- Use the improved first system.
- Add restrained real 3D foreground debris and depth parallax.
- Make the camera feel like an observatory fly-in, not a floating UI backdrop.
- Keep responsive tablet/mobile framing, reactive reduced motion, and the existing copy.
- Do not reintroduce CSS planets, CSS orbit art, SVG illustrations, or DOM card faces.

### 6. Validate before calling it complete

Required checks:

```powershell
npm run typecheck
npm run lint -- --no-cache
git diff --check
npm run build
```

Visual checks should cover:

- first system and final system;
- close and distant planet views;
- day/night terminator while orbiting;
- star core/corona without blown highlights;
- planet silhouette displacement and crater shadows;
- rings and debris from edge-on and face-on views;
- desktop, 768×1024 portrait tablet, and narrow mobile;
- reduced-motion toggle while the page is open;
- medium/low quality tiers without replacing materials with dull flat versions.

## Important performance rules

- Reuse geometry and material resources where possible.
- Avoid per-frame object allocation.
- Render only nearby systems at full fidelity.
- Use quality-tier geometry subdivisions, shadow sizes, and volumetric sample counts.
- Pause offscreen canvases and demand-render reduced-motion/static states.
- Do not silently downgrade visual quality after a few seconds.

## Deployment note

Local work and builds are independent of deployment. The persisted Sites project ID previously returned `project_not_found`, and this Next.js repository did not yet have the supported OpenNext/vinext deployment adapter expected by Sites. Do not replace the project ID or create a new site speculatively. Restore/rebind the existing Sites project and add the supported deployment build only when deployment work is explicitly resumed.

## Resume checklist

1. Read this file completely.
2. Confirm branch `experimental-ui-redesign` and baseline commit `90cceeb`.
3. Run `git status --short`; preserve `public/textures/cosmic/volcanic-basalt-albedo.png`.
4. Recreate the three non-overlapping workstreams described above.
5. Build the material maps first so the body/material agent has stable asset paths.
6. Integrate and visually verify instead of accepting shader compilation as proof of realism.
7. Do not stop until planet surfaces, stars, lighting, atmosphere, rings, debris, and camera composition all read as one physically coherent scene.
