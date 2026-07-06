@echo off
cd /d "%~dp0"
title Curiosity V4 Semantic Real Teardown

echo ============================================================
echo Curiosity V4 Semantic Real Teardown
echo Uses your uploaded GLB + semantic subsystem teardown.
echo Look for: V4 SEMANTIC ^| PORT 8788 ^| ACTUAL GLB + INTERNALS
echo ============================================================
echo.

start "" "http://127.0.0.1:8788/index.html?v=v4-semantic"

py -3 -m http.server 8788 --bind 127.0.0.1
if errorlevel 1 (
  python -m http.server 8788 --bind 127.0.0.1
)

pause
