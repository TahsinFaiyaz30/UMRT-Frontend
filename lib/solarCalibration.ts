'use client';

import { useSyncExternalStore } from 'react';

export type SolarCalibrationSettings = Readonly<{
  /** Multiplier applied to the scene's primary solar light. */
  intensity: number;
  /** Multiplier applied to the visible sun disc / bloom treatment. */
  glow: number;
  /** Visual black-body temperature, in Kelvin. */
  temperature: number;
  /** Compass bearing in degrees. North is 0, east is 90. */
  azimuth: number;
  /** Angle above the horizon in degrees. */
  elevation: number;
}>;

export type SolarCalibrationPatch = Partial<SolarCalibrationSettings>;
export type SolarCalibrationUpdate =
  | SolarCalibrationPatch
  | ((current: SolarCalibrationSettings) => SolarCalibrationPatch);

export const SOLAR_CALIBRATION_LIMITS = Object.freeze({
  intensity: Object.freeze({ min: 0, max: 2.5, step: 0.05 }),
  glow: Object.freeze({ min: 0, max: 2, step: 0.01 }),
  temperature: Object.freeze({ min: 900, max: 6500, step: 100 }),
  azimuth: Object.freeze({ min: -180, max: 180, step: 1 }),
  elevation: Object.freeze({ min: 0, max: 90, step: 1 }),
});

/** Matches the current hero key light closely, so integration is non-destructive. */
export const DEFAULT_SOLAR_CALIBRATION: SolarCalibrationSettings = Object.freeze({
  intensity: 1,
  glow: 1,
  temperature: 1800,
  azimuth: -166,
  elevation: 13,
});

export type SolarLightingValues = Readonly<{
  color: string;
  glow: number;
  intensity: number;
  position: readonly [number, number, number];
}>;

type Listener = () => void;

const listeners = new Set<Listener>();
let settings: SolarCalibrationSettings = DEFAULT_SOLAR_CALIBRATION;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

function sanitizeSettings(
  current: SolarCalibrationSettings,
  patch: SolarCalibrationPatch,
): SolarCalibrationSettings {
  return Object.freeze({
    intensity: clamp(
      patch.intensity ?? current.intensity,
      SOLAR_CALIBRATION_LIMITS.intensity.min,
      SOLAR_CALIBRATION_LIMITS.intensity.max,
    ),
    glow: clamp(
      patch.glow ?? current.glow,
      SOLAR_CALIBRATION_LIMITS.glow.min,
      SOLAR_CALIBRATION_LIMITS.glow.max,
    ),
    temperature: Math.round(clamp(
      patch.temperature ?? current.temperature,
      SOLAR_CALIBRATION_LIMITS.temperature.min,
      SOLAR_CALIBRATION_LIMITS.temperature.max,
    ) / SOLAR_CALIBRATION_LIMITS.temperature.step) * SOLAR_CALIBRATION_LIMITS.temperature.step,
    azimuth: clamp(
      patch.azimuth ?? current.azimuth,
      SOLAR_CALIBRATION_LIMITS.azimuth.min,
      SOLAR_CALIBRATION_LIMITS.azimuth.max,
    ),
    elevation: clamp(
      patch.elevation ?? current.elevation,
      SOLAR_CALIBRATION_LIMITS.elevation.min,
      SOLAR_CALIBRATION_LIMITS.elevation.max,
    ),
  });
}

function settingsAreEqual(a: SolarCalibrationSettings, b: SolarCalibrationSettings) {
  return a.intensity === b.intensity
    && a.glow === b.glow
    && a.temperature === b.temperature
    && a.azimuth === b.azimuth
    && a.elevation === b.elevation;
}

/** Read synchronously from `useFrame` without causing a React render. */
export function getSolarCalibrationSettings(): SolarCalibrationSettings {
  return settings;
}

/** Subscribe outside React, or pass directly to `useSyncExternalStore`. */
export function subscribeSolarCalibration(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSolarCalibrationSettings(update: SolarCalibrationUpdate) {
  const patch = typeof update === 'function' ? update(settings) : update;
  const next = sanitizeSettings(settings, patch);
  if (settingsAreEqual(settings, next)) return settings;

  settings = next;
  listeners.forEach((listener) => listener());
  return settings;
}

export function resetSolarCalibrationSettings() {
  return setSolarCalibrationSettings(DEFAULT_SOLAR_CALIBRATION);
}

/** Reactive hook for React and React Three Fiber components. */
export function useSolarCalibrationSettings() {
  return useSyncExternalStore(
    subscribeSolarCalibration,
    getSolarCalibrationSettings,
    () => DEFAULT_SOLAR_CALIBRATION,
  );
}

const temperatureColorCache = new Map<number, string>();
const toHex = (channel: number) => Math.round(clamp(channel, 0, 1) * 255)
  .toString(16)
  .padStart(2, '0');
const asymmetricGaussian = (
  wavelength: number,
  amplitude: number,
  center: number,
  leftWidth: number,
  rightWidth: number,
) => {
  const scaled = (wavelength - center) * (wavelength < center ? leftWidth : rightWidth);
  return amplitude * Math.exp(-0.5 * scaled * scaled);
};
const cie1931Approximation = (wavelength: number) => ({
  x: asymmetricGaussian(wavelength, 1.056, 599.8, 0.0264, 0.0323)
    + asymmetricGaussian(wavelength, 0.362, 442, 0.0624, 0.0374)
    - asymmetricGaussian(wavelength, 0.065, 501.1, 0.049, 0.0382),
  y: asymmetricGaussian(wavelength, 0.821, 568.8, 0.0213, 0.0247)
    + asymmetricGaussian(wavelength, 0.286, 530.9, 0.0613, 0.0322),
  z: asymmetricGaussian(wavelength, 1.217, 437, 0.0845, 0.0278)
    + asymmetricGaussian(wavelength, 0.681, 459, 0.0385, 0.0725),
});
const linearToSrgb = (channel: number) => channel <= 0.0031308
  ? channel * 12.92
  : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

/**
 * Integrate Planck's law across the visible spectrum and convert the CIE XYZ
 * result to sRGB. This keeps the temperature control on the blackbody locus
 * instead of interpolating hand-picked UI colors.
 */
export function solarTemperatureToColor(temperature: number) {
  const kelvin = Math.round(clamp(
    temperature,
    SOLAR_CALIBRATION_LIMITS.temperature.min,
    SOLAR_CALIBRATION_LIMITS.temperature.max,
  ) / 100) * 100;
  const cached = temperatureColorCache.get(kelvin);
  if (cached) return cached;

  let x = 0;
  let y = 0;
  let z = 0;
  for (let wavelength = 380; wavelength <= 780; wavelength += 5) {
    const exponent = 1.438776877e7 / (wavelength * kelvin);
    const radiance = 1 / (Math.pow(wavelength, 5) * Math.expm1(exponent));
    const cie = cie1931Approximation(wavelength);
    x += radiance * cie.x;
    y += radiance * cie.y;
    z += radiance * cie.z;
  }

  const normalization = Math.max(1e-300, y);
  x /= normalization;
  z /= normalization;
  y = 1;
  let red = Math.max(0, 3.2406 * x - 1.5372 * y - 0.4986 * z);
  let green = Math.max(0, -0.9689 * x + 1.8758 * y + 0.0415 * z);
  let blue = Math.max(0, 0.0557 * x - 0.204 * y + 1.057 * z);
  const peak = Math.max(red, green, blue, 1e-6);
  red = linearToSrgb(red / peak);
  green = linearToSrgb(green / peak);
  blue = linearToSrgb(blue / peak);
  const color = `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
  temperatureColorCache.set(kelvin, color);
  return color;
}

/** Convert compass azimuth/elevation into a Three-compatible world position. */
export function solarPositionFromSettings(
  value: Pick<SolarCalibrationSettings, 'azimuth' | 'elevation'>,
  distance = 38,
): readonly [number, number, number] {
  const azimuth = value.azimuth * Math.PI / 180;
  const elevation = value.elevation * Math.PI / 180;
  const horizontalDistance = Math.cos(elevation) * distance;

  return [
    Math.sin(azimuth) * horizontalDistance,
    Math.sin(elevation) * distance,
    Math.cos(azimuth) * horizontalDistance,
  ];
}

/** Single helper for declaratively binding the settings to scene lights. */
export function solarLightingFromSettings(
  value: SolarCalibrationSettings,
  distance = 38,
): SolarLightingValues {
  return Object.freeze({
    color: solarTemperatureToColor(value.temperature),
    glow: value.glow,
    intensity: value.intensity * 3.25,
    position: solarPositionFromSettings(value, distance),
  });
}
