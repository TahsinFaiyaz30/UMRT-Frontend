# Completed Work

## 2026-07-10 — Mission Archive achievements rebuild

### Rebuilt

- Restored translucent glass hover pills on the desktop navbar.
- Replaced the rotating-card Achievements spiral with eight fixed square archive records.
- Added a scroll-driven camera helix that descends around the records and lingers at each milestone before accelerating to the next.
- Designed a central Mission Archive Core with an illuminated spine, archive nodes, data connectors, gyroscope, scanner rings, and orbiting dust.
- Added synchronized milestone typography, progress telemetry, camera rail, desktop composition, and mobile framing.

### Verified

- Multiple desktop archive positions show different camera angles around the stationary structure.
- 390 × 844 mobile view keeps the active record and core in frame with no horizontal overflow.
- Browser console contains no runtime errors after a clean reload.

## 2026-07-10 — Cinematic landing-page rebuild

### Rebuilt

- New responsive aerospace editorial art direction across the landing page.
- New scroll chapter system, synchronized progress HUD, camera choreography, pointer parallax, and immediate Lenis boot.
- New procedural dark-Mars terrain, horizon lighting, signal rings, dust, and distant forms.
- New responsive navigation, mobile panel, interaction console, and static cinematic footer.

### 3D and motion

- Preserved the authentic Curiosity GLB as the central hero asset.
- Added automatic semantic explosion/reassembly to the scroll timeline.
- Preserved the replayable teardown at the manual-control stage.
- Added a live explosion scrubber plus assembled, cutaway, and fully exploded hold states.
- Added unrestricted final-stage orbit, right-drag panning, touch gestures, and wheel zoom.
- Corrected teardown reparenting so meshes keep authored transforms and explode through subsystem groups instead of collapsing to the origin.
- Added responsive camera path and mobile FOV/distance compensation.

### Verified

- Desktop hero, story chapter, teardown chapter, manual replay, and free-explore UI.
- 390 × 844 mobile hero, navigation, story chapter, and no horizontal overflow.
- `npm run typecheck` — clean.
- `npm run build` — successful static production build.
- `git diff --check` — clean apart from expected line-ending notices.

## 2026-07-02 — Initial scaffold + first real-model integration

### Built
- Next.js 14 App Router + TypeScript + Tailwind project from empty repo.
- Configuration libs:
  - `lib/modelConfig.ts` — model path, scale, rotation, camera framing, 3 hotspots.
  - `lib/scrollTimeline.ts` — 8 normalised scroll phases + interpolation helpers.
  - `lib/performance.ts` — quality detection, DPR caps, reduced-motion probe.
- 3D experience components (`components/experience/`):
  - `MarsExperience.tsx` — orchestrates Lenis + GSAP ScrollTrigger + reduced-motion + WebGL fallback.
  - `SceneCanvas.tsx` — R3F `Canvas` with `PerformanceMonitor`, dynamic loading→hero swap, dummy lookAt target.
  - `LoadingScene.tsx` — cheap Mars ground, running proxy, dust particles, inline progress ring.
  - `HeroScene.tsx` — terrain, distant rocks, dust, full lighting.
  - `ModelRig.tsx` — `useGLTF` loader, `Box3` centering, optional `AnimationMixer`, idle-bob fallback for static models.
  - `ScrollDirector.tsx` — drives camera + lookAt + model offset + subtle rotation each frame from `progressRef.current`.
  - `FreeExploreControls.tsx` — drei `OrbitControls` gated on the last scroll phase.
  - `HeroOverlay.tsx` — DOM hero text + section panels + loading bar + final explore hint.
  - `ProxyRover.tsx` — procedural rover proxy used in the loading scene and as a permanent fallback.
- App entry: `app/page.tsx` (dynamic import, `ssr: false`), `app/layout.tsx`, `app/globals.css`.

### Asset integration
- User uploaded `24584_Curiosity_static.glb` (~11.8 MB) at the repo root.
- Files were identical, so a single asset is used for both main + load (the proxy rover visually anchors the loading scene until the GLB streams in, then the real Curiosity reveals in the hero scene).
- File relocated to `public/models/main-model.glb` (served at `/models/main-model.glb`).

### Verified
- `npm install` (459 packages, success).
- `npx tsc --noEmit` — clean.
- `npm run build` — success; route `/` is static, 296 kB First Load JS.
- `next start -p 3050` then `Invoke-WebRequest` confirms:
  - `GET /` → 200.
  - `GET /models/main-model.glb` → 200.

### Still to do (next agent)
- Tune camera framing for the actual Curiosity bounding box (currently sized to ~2 units; the Curiosity GLB may need different scale + offset since it's tall and wide).
- Verify hotspots in `lib/modelConfig.ts` line up with Curiosity mesh parts; rename hotspots (e.g. `head` → `mast`, `left-arm` → `front-left-wheel`, `right-arm` → `rear-right-wheel`) once we can see it.
- Add bling if perf allows (lightweight bloom + vignette) — currently using tone-mapping only.
- Set up `prefers-reduced-motion` test — code is in place; untested manually.
- Add a screenshot/Playwright test once visual feedback is needed.
