# Current Status

## Current Task
Bug fix session: Fixed broken website (Three.js errors, missing model, scrolling broken) and upgraded all dependencies to latest versions.

## Last Updated
2026-07-02

## What Changed Recently

### Bug Fixes Applied
1. **Scrolling Fix**: HeroOverlay sections were inside a `fixed inset-0` container, creating zero scroll height. Changed to `relative z-10` so sections flow in the document and create actual scroll distance.
2. **MarsExperience container**: Removed `h-screen overflow-y-auto` from wrapper — now `relative w-full` so document naturally grows with content.
3. **Missing model 404**: `lowPolyPath` in modelConfig.ts was set to `/models/main-model-low.glb` which doesn't exist. Set to `null`.
4. **Null geometry crashes (boundingSphere/id errors)**: `LoadingScene.tsx` used `<Instances>` + `<Instance>` pattern that created meshes with null geometry. Replaced with regular meshes in a group. Removed empty `<mesh ref={ref} />` (MeshRefHolder).
5. **ModelRig error handling**: Wrapped `useGLTF` in try/catch so missing models render the ProxyRover fallback instead of crashing. Removed preload of non-existent lowPolyPath.
6. **Next.js 15 SSR fix**: `page.tsx` needed `'use client'` directive because `ssr: false` with `next/dynamic` is not allowed in Server Components in Next.js 15.
7. **globals.css**: Added explicit `overflow-y: scroll` on html element.
8. **Added native scroll fallback**: Added `window.addEventListener('scroll', ...)` in MarsExperience as fallback for scroll progress.

### Dependency Upgrades
- Next.js: 14.2.5 → 15.5.19
- React: 18.3.1 → 19.x
- Three.js: 0.165.0 → 0.175.x
- @react-three/fiber: 8.16.8 → 9.x
- @react-three/drei: 9.108.3 → 10.x
- gsap: 3.12.5 → 3.12.7+
- @gsap/react: 2.1.1 → 2.1.2
- lenis: 1.1.6 → 1.3.x
- All @types packages updated
- TypeScript: 5.5.3 → 5.8.x

### React 19 / R3F v9 Migration
- Changed all `MutableRefObject` types to `RefObject` (React 19 change)
- Added null-safe access to ref `.current` values
- Removed `as never` type casts

## Files Touched
- `app/page.tsx` — added 'use client'
- `app/globals.css` — added overflow-y: scroll
- `lib/modelConfig.ts` — set lowPolyPath to null
- `components/experience/LoadingScene.tsx` — rewrote to fix null geometry
- `components/experience/MarsExperience.tsx` — fixed scroll container
- `components/experience/HeroOverlay.tsx` — fixed scroll layout (relative vs fixed)
- `components/experience/SceneCanvas.tsx` — React 19 ref types
- `components/experience/ScrollDirector.tsx` — React 19 ref types
- `components/experience/FreeExploreControls.tsx` — React 19 ref types
- `components/experience/ModelRig.tsx` — error handling, removed lowPolyPath preload
- `package.json` — all dependencies updated

## Commands Run
- `Remove-Item node_modules, package-lock.json, .next`
- `npm install --legacy-peer-deps`
- `npm run dev`

## Next Steps
1. Verify the scroll-driven parallax works smoothly in browser.
2. Test the free explore (OrbitControls) at end of scroll.
3. Consider adding the real 3D model to `/public/models/main-model.glb`.
4. Run `npm run build` to verify production build.

## Blockers
- None currently. Dev server compiles and serves 200 OK.
