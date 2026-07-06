'use client';

/**
 * LoadingCanvasShell
 *
 * Pure DOM/CSS placeholder. We deliberately do NOT render an R3F
 * <Canvas> here, because mounting a WebGL context only to throw it
 * away when the real Canvas swaps in causes a "context lost" GPU
 * stall that the browser interprets as a hang.
 *
 * The animated "running rover" is implemented in pure CSS so the
 * browser paints it on the compositor thread with zero JS overhead
 * after first paint.
 */

export function LoadingCanvasShell() {
  return (
    <>
      <style jsx global>{`
        .lcs-root {
          background: radial-gradient(
            circle at 50% 60%,
            #6B3818 0%,
            #4A2818 55%,
            #2A1208 100%
          );
        }
        .lcs-horizon {
          position: absolute;
          inset-inline: 0;
          bottom: 0;
          height: 33%;
          background: linear-gradient(
            to top,
            rgba(160, 104, 56, 0.55),
            rgba(74, 40, 24, 0) 80%
          );
          pointer-events: none;
        }
        .lcs-rover {
          width: 96px;
          height: 96px;
          will-change: transform;
          animation: lcsRun 5s ease-in-out infinite alternate;
        }
        .lcs-rover svg {
          animation: lcsBob 0.4s linear infinite;
          transform-origin: 48px 78px;
        }
        @keyframes lcsRun {
          0% { transform: translateX(-120px); }
          100% { transform: translateX(120px); }
        }
        @keyframes lcsBob {
          0% { transform: translateY(0) rotate(-1deg); }
          25% { transform: translateY(-4px) rotate(-1.4deg); }
          50% { transform: translateY(0) rotate(1deg); }
          75% { transform: translateY(-4px) rotate(1.4deg); }
          100% { transform: translateY(0) rotate(-1deg); }
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden lcs-root">
        <div className="lcs-horizon" />
        <div className="absolute inset-0 flex items-end justify-center pb-28">
          <div className="lcs-rover">
            <svg
              viewBox="0 0 96 96"
              width="96"
              height="96"
              xmlns="http://www.w3.org/2000/svg"
            >
              <ellipse cx="48" cy="78" rx="28" ry="4" fill="rgba(0,0,0,0.45)" />
              <rect x="22" y="36" width="52" height="30" rx="3" fill="#b8431b" />
              <circle cx="48" cy="24" r="11" fill="#2f0f06" />
              <circle cx="44" cy="22" r="2" fill="#ffb27c" />
              <g fill="#5a1d0c">
                <rect x="26" y="58" width="8" height="16" rx="1.5" />
                <rect x="62" y="58" width="8" height="16" rx="1.5" />
                <rect x="22" y="72" width="16" height="4" rx="1" />
                <rect x="58" y="72" width="16" height="4" rx="1" />
              </g>
              <line
                x1="48"
                y1="14"
                x2="48"
                y2="4"
                stroke="#5a1d0c"
                strokeWidth="1.5"
              />
              <circle cx="48" cy="3" r="1.5" fill="#ffb27c" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}