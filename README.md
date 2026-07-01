# UMRT — Mission Mars (scroll-driven 3D landing)

A cinematic, scroll-driven React/Next.js landing page where a user 3D model appears on Mars while loading, becomes the central animated object of a Mars-rover landing-page experience (camera zooms, part closeups, model shifts left/right), and finally unlocks free pan/zoom.

Built with **Next.js App Router + TypeScript + React Three Fiber + drei + GSAP ScrollTrigger + Lenis + Tailwind**.

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Adding your 3D model

Drop a `.glb` file at:

```
public/models/main-model.glb
```

That single file is everything the experience needs. If you also have a low-poly version, place it at:

```
public/models/main-model-low.glb
```

If no model is supplied, a procedural proxy rover renders so the page is **never blank**.

## Agent handover

`agent-context/` contains:

- `MAIN_PLAN.md` — vision, stack, scene timeline, architecture.
- `CURRENT_STATUS.md` — what is being worked on right now.
- `COMPLETED_WORK.md` — finished features and decisions.

Any new agent session must read these three files before touching code.
