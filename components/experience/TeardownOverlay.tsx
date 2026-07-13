'use client';

export function TeardownOverlay({
  visible,
  playing,
  progress,
  onScrub,
  onTrigger,
}: {
  visible: boolean;
  playing: boolean;
  progress: number;
  onScrub: (value: number) => void;
  onTrigger: () => void;
}) {
  if (!visible) return null;

  const stopPointer = (event: React.SyntheticEvent) => event.stopPropagation();
  const percentage = Math.round(progress * 100);

  return (
    <div
      className="teardown-console"
      data-playing={playing}
      onPointerDown={stopPointer}
      onTouchStart={stopPointer}
      data-lenis-prevent
    >
      <div className="teardown-console-panel">
        <div className="teardown-console-heading">
          <span className="teardown-console-status" aria-hidden="true" />
          <span className="teardown-console-copy">
            <small>SEMANTIC SYSTEM / {playing ? 'AUTO SEQUENCE' : 'MANUAL CONTROL'}</small>
            <strong>{playing ? 'Teardown sequence active…' : 'Subsystem separation'}</strong>
          </span>
          <output aria-live="polite">{playing ? 'AUTO' : `${percentage}%`}</output>
        </div>

        <label className="teardown-scrubber">
          <span className="sr-only">Rover subsystem explosion amount</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={percentage}
            disabled={playing}
            aria-label="Rover subsystem explosion amount"
            onInput={(event) => onScrub(Number(event.currentTarget.value) / 100)}
            onChange={(event) => onScrub(Number(event.currentTarget.value) / 100)}
          />
          <span className="teardown-scrubber-fill" style={{ width: `${percentage}%` }} />
          <span className="teardown-scrubber-ticks" aria-hidden="true" />
        </label>

        <div className="teardown-presets" aria-label="Explosion presets">
          {[
            { value: 0, label: 'ASSEMBLED' },
            { value: 0.5, label: 'CUTAWAY' },
            { value: 1, label: 'EXPLODED' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={playing}
              aria-label={`Set rover explosion to ${Math.round(preset.value * 100)} percent`}
              data-active={!playing && Math.abs(progress - preset.value) < 0.01}
              onClick={(event) => {
                event.stopPropagation();
                onScrub(preset.value);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="teardown-console-actions">
          <span>DRAG TO HOLD ANY EXPLODED STATE</span>
          <button
            type="button"
            disabled={playing}
            onPointerDown={stopPointer}
            onClick={(event) => {
              event.stopPropagation();
              onTrigger();
            }}
          >
            {playing ? 'RUNNING 06.4 S' : 'AUTO SEQUENCE ↗'}
          </button>
        </div>
      </div>
    </div>
  );
}
