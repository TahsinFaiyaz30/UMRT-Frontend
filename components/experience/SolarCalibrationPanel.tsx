'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type SyntheticEvent,
} from 'react';
import {
  DEFAULT_SOLAR_CALIBRATION,
  MARS_AUTO_SOL_DURATION_SECONDS,
  SOLAR_CALIBRATION_LIMITS,
  automaticMarsSunCoordinatesAt,
  resetSolarCalibrationSettings,
  setSolarCalibrationSettings,
  solarTemperatureToColor,
  useSolarCalibrationSettings,
  type MarsSunCoordinates,
} from '@/lib/solarCalibration';
import styles from './SolarCalibrationPanel.module.css';

type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  tone?: 'neutral' | 'temperature';
  onChange: (value: number) => void;
};

export type SolarCalibrationPanelProps = {
  className?: string;
  defaultOpen?: boolean;
};

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  tone = 'neutral',
  onChange,
}: RangeControlProps) {
  const fill = ((value - min) / Math.max(0.001, max - min)) * 100;
  const style = { '--range-fill': `${fill}%` } as CSSProperties;

  return (
    <label className={styles.rangeControl}>
      <span className={styles.rangeLabel}>
        <span>{label}</span>
        <output>{displayValue}</output>
      </span>
      <input
        className={tone === 'temperature' ? styles.temperatureRange : styles.range}
        style={style}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={displayValue}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

const temperatureStops = [
  900,
  1800,
  2800,
  4000,
  5200,
  6500,
];
const temperatureSpectrum = `linear-gradient(90deg, ${temperatureStops
  .map((temperature) => {
    const position = (temperature - SOLAR_CALIBRATION_LIMITS.temperature.min)
      / (SOLAR_CALIBRATION_LIMITS.temperature.max - SOLAR_CALIBRATION_LIMITS.temperature.min) * 100;
    return `${solarTemperatureToColor(temperature)} ${position.toFixed(2)}%`;
  })
  .join(', ')})`;

const wrapAzimuth = (value: number) => {
  if (value > 180) return value - 360;
  if (value < -180) return value + 360;
  return value;
};

export function SolarCalibrationPanel({
  className = '',
  defaultOpen = false,
}: SolarCalibrationPanelProps) {
  const settings = useSolarCalibrationSettings();
  const [open, setOpen] = useState(defaultOpen);
  const [automaticPosition, setAutomaticPosition] = useState<MarsSunCoordinates>({
    azimuth: DEFAULT_SOLAR_CALIBRATION.azimuth,
    elevation: DEFAULT_SOLAR_CALIBRATION.elevation,
    localSolarTimeHours: 6,
  });
  const activePointer = useRef<number | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const instructionId = useId();

  const displayedPosition = settings.autoSunCycle ? automaticPosition : settings;
  const displayedElevation = Math.max(0, displayedPosition.elevation);
  const radial = 1 - displayedElevation / 90;
  const azimuthRadians = displayedPosition.azimuth * Math.PI / 180;
  const joystickX = Math.sin(azimuthRadians) * radial;
  const joystickY = -Math.cos(azimuthRadians) * radial;
  const temperatureColor = solarTemperatureToColor(settings.temperature);
  const rootClassName = `${styles.root}${className ? ` ${className}` : ''}`;
  const rootStyle = { '--temperature-spectrum': temperatureSpectrum } as CSSProperties;
  const joystickStyle = {
    '--joystick-left': `${50 + joystickX * 39}%`,
    '--joystick-top': `${50 + joystickY * 39}%`,
    '--sun-color': temperatureColor,
  } as CSSProperties;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      window.requestAnimationFrame(() => toggleRef.current?.focus());
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  // The 3D scene updates the sun through a mutable ref every frame. The panel
  // samples that same clock at 10 Hz and lets CSS interpolate the indicator,
  // avoiding a full React render on every animation frame.
  useEffect(() => {
    if (!open || !settings.autoSunCycle) return undefined;
    const samplePosition = () => {
      setAutomaticPosition(automaticMarsSunCoordinatesAt(performance.now()));
    };
    samplePosition();
    const interval = window.setInterval(samplePosition, 100);
    return () => window.clearInterval(interval);
  }, [open, settings.autoSunCycle]);

  const toggleAutomaticSun = useCallback(() => {
    if (settings.autoSunCycle) {
      const current = automaticMarsSunCoordinatesAt(performance.now());
      setSolarCalibrationSettings({
        autoSunCycle: false,
        azimuth: current.azimuth,
        elevation: current.elevation,
      });
      return;
    }
    setSolarCalibrationSettings({ autoSunCycle: true });
  }, [settings.autoSunCycle]);

  const updatePositionFromPointer = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const magnitude = Math.hypot(x, y);

    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }

    const clampedMagnitude = Math.min(1, magnitude);
    setSolarCalibrationSettings({
      azimuth: Math.atan2(x, -y) * 180 / Math.PI,
      elevation: (1 - clampedMagnitude) * 90,
    });
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePositionFromPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updatePositionFromPointer(event);
  };

  const releasePointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleJoystickKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const fine = event.shiftKey ? 1 : 5;
    let handled = true;

    switch (event.key) {
      case 'ArrowLeft':
        setSolarCalibrationSettings({ azimuth: wrapAzimuth(settings.azimuth - fine) });
        break;
      case 'ArrowRight':
        setSolarCalibrationSettings({ azimuth: wrapAzimuth(settings.azimuth + fine) });
        break;
      case 'ArrowUp':
        setSolarCalibrationSettings({ elevation: settings.elevation + fine });
        break;
      case 'ArrowDown':
        setSolarCalibrationSettings({ elevation: settings.elevation - fine });
        break;
      case 'Home':
        setSolarCalibrationSettings({
          azimuth: DEFAULT_SOLAR_CALIBRATION.azimuth,
          elevation: DEFAULT_SOLAR_CALIBRATION.elevation,
        });
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <aside
      className={rootClassName}
      style={rootStyle}
      data-open={open}
      data-lenis-prevent
      aria-label="Solar calibration"
      onPointerDown={stopPropagation}
      onTouchStart={stopPropagation}
      onWheel={stopPropagation}
    >
      <button
        ref={toggleRef}
        className={styles.toggle}
        type="button"
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={open ? 'Close solar calibration' : 'Open solar calibration'}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.toggleGlyph} aria-hidden="true"><i /></span>
        <span className={styles.toggleLabel}>SOLAR</span>
        <span className={styles.toggleChevron} aria-hidden="true">{open ? '›' : '‹'}</span>
      </button>

      <section
        id={panelId}
        className={styles.panel}
        aria-hidden={!open}
        inert={!open}
      >
        <header className={styles.header}>
          <div>
            <p>OPTICAL ENV / LIVE</p>
            <h2>Solar calibration</h2>
          </div>
          <span className={styles.liveStatus}><i /> SYNC</span>
        </header>

        <div className={styles.readout}>
          <div className={styles.sunPreview} style={{ '--sun-color': temperatureColor } as CSSProperties}>
            <span aria-hidden="true" />
          </div>
          <div>
            <small>FILTERED ILLUMINANT</small>
            <strong>{settings.temperature.toLocaleString('en-US')} K</strong>
          </div>
          <code>{temperatureColor.toUpperCase()}</code>
        </div>

        <div className={styles.sliders}>
          <RangeControl
            label="Solar intensity"
            value={settings.intensity}
            min={SOLAR_CALIBRATION_LIMITS.intensity.min}
            max={SOLAR_CALIBRATION_LIMITS.intensity.max}
            step={SOLAR_CALIBRATION_LIMITS.intensity.step}
            displayValue={`${settings.intensity.toFixed(2)}×`}
            onChange={(intensity) => setSolarCalibrationSettings({ intensity })}
          />
          <RangeControl
            label="Horizon glow"
            value={settings.glow}
            min={SOLAR_CALIBRATION_LIMITS.glow.min}
            max={SOLAR_CALIBRATION_LIMITS.glow.max}
            step={SOLAR_CALIBRATION_LIMITS.glow.step}
            displayValue={`${Math.round(settings.glow * 100)}%`}
            onChange={(glow) => setSolarCalibrationSettings({ glow })}
          />
          <RangeControl
            label="Atmospheric illuminant CCT"
            value={settings.temperature}
            min={SOLAR_CALIBRATION_LIMITS.temperature.min}
            max={SOLAR_CALIBRATION_LIMITS.temperature.max}
            step={SOLAR_CALIBRATION_LIMITS.temperature.step}
            displayValue={`${settings.temperature.toLocaleString('en-US')} K`}
            tone="temperature"
            onChange={(temperature) => setSolarCalibrationSettings({ temperature })}
          />
          <div className={styles.temperatureEnds} aria-hidden="true">
            <span>DEEPEST RED</span>
            <span>WHITE-HOT</span>
          </div>
        </div>

        <div className={styles.autoCycleRow}>
          <div>
            <span>AUTO SUN CYCLE</span>
            <small>{MARS_AUTO_SOL_DURATION_SECONDS / 60} MIN / MARTIAN SOL</small>
          </div>
          <button
            className={styles.autoCycleSwitch}
            type="button"
            role="switch"
            aria-checked={settings.autoSunCycle}
            aria-label="Automatic Martian sunrise and sunset"
            onClick={toggleAutomaticSun}
          >
            <span>{settings.autoSunCycle ? 'AUTO' : 'MANUAL'}</span>
            <i aria-hidden="true" />
          </button>
        </div>

        <div className={styles.positionHeading}>
          <div>
            <span>SUN POSITION</span>
            <small>
              {settings.autoSunCycle
                ? `AUTO / MST ${String(Math.floor(automaticPosition.localSolarTimeHours)).padStart(2, '0')}H`
                : 'DRAG TO ORIENT'}
            </small>
          </div>
          <div className={styles.coordinates}>
            <span><small>AZ</small>{Math.round(displayedPosition.azimuth)}°</span>
            <span><small>EL</small>{Math.round(displayedPosition.elevation)}°</span>
          </div>
        </div>

        <div className={styles.joystickShell}>
          <span className={styles.cardinalNorth} aria-hidden="true">N</span>
          <span className={styles.cardinalEast} aria-hidden="true">E</span>
          <span className={styles.cardinalSouth} aria-hidden="true">S</span>
          <span className={styles.cardinalWest} aria-hidden="true">W</span>
          <button
            className={styles.joystick}
            style={joystickStyle}
            type="button"
            disabled={settings.autoSunCycle}
            aria-label={settings.autoSunCycle
              ? `Automatic sun position: azimuth ${Math.round(displayedPosition.azimuth)} degrees, elevation ${Math.round(displayedPosition.elevation)} degrees`
              : `Sun position: azimuth ${Math.round(settings.azimuth)} degrees, elevation ${Math.round(settings.elevation)} degrees`}
            aria-describedby={instructionId}
            aria-roledescription="circular sun position control"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
            onKeyDown={handleJoystickKeyDown}
          >
            <span className={styles.orbitRing} aria-hidden="true" />
            <span className={styles.joystickAxis} aria-hidden="true" />
            <span className={styles.joystickKnob} aria-hidden="true"><i /></span>
          </button>
        </div>
        <p id={instructionId} className={styles.instructions}>
          {settings.autoSunCycle
            ? 'Automatic Martian sun tracking is active. Switch to manual mode to adjust the position.'
            : 'Drag around the compass to set azimuth; move toward the center to raise the sun. Arrow keys adjust, Shift makes fine adjustments, and Home restores its position.'}
        </p>

        <footer className={styles.footer}>
          <span>SCENE LIGHT / PRIMARY</span>
          <button type="button" onClick={resetSolarCalibrationSettings}>
            RESET CALIBRATION
          </button>
        </footer>
      </section>
    </aside>
  );
}
