Curiosity V4 Semantic Real Teardown

This version is different from the random chunk version:
- It uses your uploaded GLB as the exterior.
- It classifies rover regions: six wheels, left/right rocker-bogie suspension, mast, arm/turret, upper deck, body, rear power/comms.
- Each subsystem moves in a deliberate teardown direction.
- It adds internal science/avionics modules only after the body opens.
- It keeps the original rover geometry/textures instead of replacing it with a fake rover.

How to run:
1. Close previous viewer/server windows.
2. Extract this ZIP to a new folder.
3. Double-click START_V4_SEMANTIC.bat.
4. Open http://127.0.0.1:8788/index.html?v=v4-semantic
5. Confirm the label says: V4 SEMANTIC • PORT 8788 • ACTUAL GLB + INTERNALS

Controls:
- Play / click canvas: play or rewind teardown
- Slider: scrub teardown progress
- Mouse wheel: scrub teardown
- Ctrl + wheel: zoom
- Left drag: rotate
- Right drag: pan
- Internals button: show/hide added internals
