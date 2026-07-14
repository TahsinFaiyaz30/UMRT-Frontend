'use client';

import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';

export function MissionLoader({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const { progress, item } = useProgress();
  const [exiting, setExiting] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    document.documentElement.dataset.missionLoading = 'true';
    return () => {
      delete document.documentElement.dataset.missionLoading;
    };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    let exitTimer = 0;
    let completeTimer = 0;
    let cancelled = false;
    const minimumHold = Math.max(0, 1250 - (Date.now() - startedAt.current));

    Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise<void>((resolve) => { exitTimer = window.setTimeout(resolve, minimumHold); }),
    ]).then(() => {
      if (cancelled) return;
      setExiting(true);
      completeTimer = window.setTimeout(() => {
        if (!cancelled) onComplete();
      }, 880);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [ready, onComplete]);

  const percent = ready ? 100 : Math.min(96, Math.max(3, Math.round(progress * 0.96)));
  const assetName = item?.split('/').pop()?.replace(/[_-]/g, ' ') ?? 'mission environment';

  return (
    <div className="mission-loader" data-exiting={exiting} role="status" aria-live="polite">
      <div className="mission-loader-noise" aria-hidden="true" />
      <div className="mission-loader-scan" aria-hidden="true" />

      <div className="mission-loader-top">
        <span>UMRT / PRE-FLIGHT SEQUENCE</span>
        <span>SYS 97.10</span>
      </div>

      <div className="mission-loader-core">
        <div className="mission-loader-mark" aria-hidden="true"><i /><i /><i /></div>
        <p>ASSEMBLING MISSION</p>
        <strong>{String(percent).padStart(3, '0')}<small>%</small></strong>
        <div className="mission-loader-track"><i style={{ width: `${percent}%` }} /></div>
        <span>{ready ? 'VISUAL SYSTEMS ONLINE' : `LOADING / ${assetName}`}</span>
      </div>

      <div className="mission-loader-log" aria-hidden="true">
        <span>01 / GEOMETRY</span>
        <span>02 / MATERIALS</span>
        <span>03 / TERRAIN</span>
        <span>04 / FLIGHT CAMERA</span>
      </div>
    </div>
  );
}

export default MissionLoader;
