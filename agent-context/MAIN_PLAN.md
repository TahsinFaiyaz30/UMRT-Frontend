# Mars Scroll Parallax 3D Landing Website - Main Plan

## Vision
Create a cinematic React/Next.js landing page where a user-provided 3D model runs on Mars during loading, then appears in a scroll-driven Mars rover environment. Scrolling zooms the camera and text, reveals the model, focuses on different parts, moves the model left/right, and finally unlocks free pan/zoom controls.

## Chosen Stack
- Next.js App Router
- TypeScript
- React Three Fiber
- Drei
- Three.js
- GSAP + ScrollTrigger + @gsap/react
- Lenis smooth scroll
- Tailwind CSS

## Core UX Timeline
1. Lightweight loading scene: Mars ground, warm dusty atmosphere, user model running/looping.
2. Landing hero: huge text in foreground, Mars rover environment behind it, model far away.
3. Scroll phase A: camera/model/text zoom inward; hero text scales and fades out.
4. Scroll phase B: full model reveal.
5. Scroll phase C: closeup sequence of important model parts.
6. Scroll phase D: model shifts left, then right, with text/content panels.
7. Final phase: scroll animation completes and OrbitControls/free pan/zoom unlocks.

## Asset Plan
- User main model: `/public/models/main-model.glb` (configurable)
- Optional low-poly/loading model: `/public/models/main-model-low.glb`
- Fallback: procedurally generated rover-style proxy if models are absent (no blank page).

## Architecture
- `app/page.tsx`: landing route
- `components/experience/MarsExperience.tsx`: client-only 3D root + scroll director
- `components/experience/SceneCanvas.tsx`: R3F Canvas (dynamic, SSR off)
- `components/experience/LoadingScene.tsx`: lightweight loading animation
- `components/experience/HeroScene.tsx`: full scene after load
- `components/experience/ModelRig.tsx`: GLB loader + hotspot anchors + refs
- `components/experience/ScrollDirector.tsx`: scroll progress → camera/model states
- `components/experience/FreeExploreControls.tsx`: OrbitControls gated on last phase
- `components/experience/HeroOverlay.tsx`: DOM hero text + section content + hint
- `components/experience/ProxyRover.tsx`: simple procedural fallback mesh
- `lib/modelConfig.ts`: paths, scale, rotation, hotspots, camera framing
- `lib/scrollTimeline.ts`: phase ranges, easing, helpers
- `lib/performance.ts`: DPR caps, reduced-motion, quality helpers

## Scene Phases (normalized 0..1)
- `hero_intro`        0.00–0.12  hero text big, model far
- `zoom_in`           0.12–0.28  camera dolly in, text fades out
- `full_model_reveal` 0.28–0.42  camera frames complete model
- `part_focus_1`      0.42–0.55  closeup on hotspot 1
- `part_focus_2_left` 0.55–0.68  model on left side, content panel right
- `part_focus_3_right`0.68–0.82  model on right side, content panel left
- `final_recenter`    0.82–0.94  model recenters
- `free_explore_unlock` 0.94–1.00 OrbitControls enabled

## Acceptance Criteria
- No blank page while models load (proxy + loading scene is immediate).
- Loading scene is lightweight (low DPR, basic lighting, simple proxy motion).
- Hero text scales up and fades on scroll zoom.
- Model closeups use configurable hotspots.
- Model shifts left and right during scroll sections.
- After final phase, OrbitControls allow free rotate / pan / zoom.
- `prefers-reduced-motion` swaps to a static hero with limited camera motion.
- Mobile fallback lowers DPR, particle counts, fog density, and disables post-processing.
- WebGL unsupported → static hero fallback.
- agent-context/ files are always present and updated.

## Model Optimization Pipeline
- Recommended: `gltf-transform` or `gltfpack` to compress the user GLB.
- Save optimized to `/public/models/main-model.optimized.glb`.
- Keep original untouched at `/public/models/main-model.glb`.
- If `gltf-transform` is installed: `npx gltf-transform optimize input.glb output.glb`.
