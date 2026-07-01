# Completed Work

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
