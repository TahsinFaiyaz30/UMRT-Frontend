/**
 * Deterministic orbital and axial motion for the Solar System.
 *
 * The values below are compact, approximate orbital elements with illustrative
 * starting phases (a visual simulation, not a live or historical ephemeris).
 * Positions are evaluated with Kepler's equation in a right-handed y-up frame:
 * x=ecliptic x, y=ecliptic z, z=-ecliptic y. A prograde orbit goes from +x to -z.
 * Satellite elements use the reference plane stated on each definition;
 * parent-equator outputs need the parent's fixed axial tilt applied by the
 * renderer, independently of its daily spin. The
 * numerical state is deliberately mutable: update() performs no per-frame
 * allocations, which keeps a long scrolling voyage from growing the heap.
 *
 * References:
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * https://science.nasa.gov/solar-system/solar-system-facts/
 * https://nssdc.gsfc.nasa.gov/planetary/factsheet/
 * https://ssd.jpl.nasa.gov/sats/elem/
 */

export const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
export const TWO_PI = Math.PI * 2;

export interface MutableVector3 {
  x: number;
  y: number;
  z: number;
}

export interface SolarBodyDefinition {
  /** Stable lower-case key used when linking a moon to its parent. */
  readonly id: string;
  readonly name: string;
  readonly kind: 'star' | 'planet' | 'dwarf-planet' | 'moon';
  readonly parentId: string | null;
  /** Semi-major axis in kilometres. Zero means the body is the reference Sun. */
  readonly semiMajorAxisKm: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly ascendingNodeDeg: number;
  readonly argumentOfPeriapsisDeg: number;
  readonly meanAnomalyDeg: number;
  readonly orbitalPeriodDays: number;
  /** Sidereal rotation period in hours. Negative values are retrograde. */
  readonly rotationPeriodHours: number;
  readonly axialTiltDeg: number;
  /** Directed spin-axis tilt; keep values beyond 90 degrees for retrograde axes. */
  readonly spinAxisTiltDeg: number;
  /** Apply around the tilted local +y axis; does not count retrograde twice. */
  readonly localRotationSign: 1 | -1;
  readonly tidallyLocked: boolean;
  readonly orbitReferencePlane: 'ecliptic' | 'parent-equator';
  readonly radiusKm: number;
}

export interface OrbitalMotionOptions {
  /** Scene units per astronomical unit. Moon orbits use the same scale. */
  readonly distanceScale?: number;
  /** Seconds at which the initial orbital elements are evaluated. */
  readonly epochSeconds?: number;
}

export interface OrbitalMotionState {
  readonly position: MutableVector3;
  readonly velocity: MutableVector3;
  /** Spin angle around the body's tilted local +y axis, in radians. */
  rotation: number;
  /** Signed angular velocity in radians per simulation second. */
  angularVelocity: number;
}

export interface OrbitalMotion {
  readonly body: SolarBodyDefinition;
  readonly state: OrbitalMotionState;
  /** Evaluate at simulation time in seconds, optionally relative to a parent. */
  update: (timeSeconds: number, parentState?: Readonly<OrbitalMotionState>) => void;
}

const radians = Math.PI / 180;

function body(
  id: string,
  name: string,
  kind: SolarBodyDefinition['kind'],
  parentId: string | null,
  semiMajorAxisKm: number,
  eccentricity: number,
  inclinationDeg: number,
  ascendingNodeDeg: number,
  argumentOfPeriapsisDeg: number,
  meanAnomalyDeg: number,
  orbitalPeriodDays: number,
  rotationPeriodHours: number,
  axialTiltDeg: number,
  radiusKm: number,
): SolarBodyDefinition {
  // Venus/Uranus/Pluto have a downward directed spin axis: a positive local
  // spin around that axis already rotates retrograde in the reference plane.
  // Negating the angle as well would erroneously make them prograde again.
  const directedAxisSign = Math.cos(axialTiltDeg * radians) < 0 ? -1 : 1;
  const periodSign = rotationPeriodHours < 0 ? -1 : 1;
  return {
    id,
    name,
    kind,
    parentId,
    semiMajorAxisKm,
    eccentricity,
    inclinationDeg,
    ascendingNodeDeg,
    argumentOfPeriapsisDeg,
    meanAnomalyDeg,
    orbitalPeriodDays,
    rotationPeriodHours,
    axialTiltDeg,
    spinAxisTiltDeg: axialTiltDeg,
    localRotationSign: (periodSign * directedAxisSign) as 1 | -1,
    tidallyLocked: kind === 'moon',
    orbitReferencePlane: kind === 'moon' && id !== 'moon' ? 'parent-equator' : 'ecliptic',
    radiusKm,
  };
}

/**
 * Real Solar System bodies and selected major moons. Rounded mean elements
 * preserve orbital periods, eccentricities and broad inclinations; simplified
 * satellite nodes/phases do not claim a consistent measurement epoch. Solar
 * differential rotation and changing planetary weather are not rigid surfaces.
 */
export const SOLAR_SYSTEM_BODIES: readonly SolarBodyDefinition[] = [
  body('sun', 'Sun', 'star', null, 0, 0, 0, 0, 0, 0, 0, 609.12, 7.25, 696_340),
  body('mercury', 'Mercury', 'planet', 'sun', 57_909_227, 0.205636, 7.005, 48.331, 29.124, 174.796, 87.969, 1_407.6, 0.034, 2_439.4),
  body('venus', 'Venus', 'planet', 'sun', 108_209_475, 0.006776, 3.3947, 76.680, 54.891, 50.115, 224.701, -5_832.5, 177.36, 6_051.8),
  body('earth', 'Earth', 'planet', 'sun', 149_598_262, 0.016711, 0.00005, -11.26064, 114.20783, 357.51716, 365.256, 23.9345, 23.439, 6_371.0084),
  body('moon', 'Moon', 'moon', 'earth', 384_400, 0.0549, 5.145, 125.08, 318.15, 115.3654, 27.321661, 655.72, 6.68, 1_737.4),
  body('mars', 'Mars', 'planet', 'sun', 227_943_824, 0.093394, 1.8497, 49.558, 286.502, 19.373, 686.98, 24.6229, 25.19, 3_389.5),
  body('phobos', 'Phobos', 'moon', 'mars', 9_376, 0.0151, 1.093, 0, 0, 0, 0.31891, 7.654, 1.08, 11.1),
  body('deimos', 'Deimos', 'moon', 'mars', 23_463, 0.00033, 0.93, 0, 0, 180, 1.26244, 30.30, 0.93, 6.2),
  body('jupiter', 'Jupiter', 'planet', 'sun', 778_340_821, 0.048393, 1.303, 100.556, 273.877, 20.020, 4_332.59, 9.925, 3.13, 69_911),
  body('io', 'Io', 'moon', 'jupiter', 421_700, 0.0041, 0.036, 0, 0, 0, 1.769137, 42.459, 0.05, 1_821.6),
  body('europa', 'Europa', 'moon', 'jupiter', 671_034, 0.0094, 0.466, 0, 0, 180, 3.551181, 85.229, 0.1, 1_560.8),
  body('ganymede', 'Ganymede', 'moon', 'jupiter', 1_070_412, 0.0013, 0.177, 0, 0, 90, 7.154553, 171.709, 0.33, 2_634.1),
  body('callisto', 'Callisto', 'moon', 'jupiter', 1_882_709, 0.0074, 0.192, 0, 0, 270, 16.689018, 400.536, 0.44, 2_410.3),
  body('saturn', 'Saturn', 'planet', 'sun', 1_426_666_422, 0.053862, 2.485, 113.715, 339.392, 317.020, 10_759.22, 10.656, 26.73, 58_232),
  body('titan', 'Titan', 'moon', 'saturn', 1_221_870, 0.0288, 0.34854, 0, 0, 0, 15.945421, 382.69, 26.73, 2_574.7),
  body('rhea', 'Rhea', 'moon', 'saturn', 527_040, 0.001, 0.345, 0, 0, 120, 4.5175, 108.42, 0, 763.8),
  body('iapetus', 'Iapetus', 'moon', 'saturn', 3_560_820, 0.0283, 15.47, 0, 0, 240, 79.3215, 1_903.72, 0, 734.5),
  body('uranus', 'Uranus', 'planet', 'sun', 2_870_658_186, 0.047257, 0.7739, 74.2299, 96.9989, 142.2386, 30_688.5, -17.24, 97.77, 25_362),
  body('titania', 'Titania', 'moon', 'uranus', 435_910, 0.0011, 0.079, 0, 0, 0, 8.705872, 208.941, 0, 788.9),
  body('oberon', 'Oberon', 'moon', 'uranus', 583_520, 0.0014, 0.068, 0, 0, 180, 13.463234, 323.117, 0, 761.4),
  body('neptune', 'Neptune', 'planet', 'sun', 4_498_396_441, 0.008586, 1.770, 131.72169, 273.249, 256.228, 60_190.0, 16.11, 28.32, 24_622),
  body('triton', 'Triton', 'moon', 'neptune', 354_759, 0.000016, 156.865, 0, 0, 180, 5.876854, -141.05, 157.3, 1_353.4),
  body('pluto', 'Pluto', 'dwarf-planet', 'sun', 5_906_376_272, 0.248808, 17.14175, 110.299, 113.834, 14.53, 90_560.0, -153.2928, 122.53, 1_188.3),
  body('charon', 'Charon', 'moon', 'pluto', 19_591, 0.0002, 0.0018, 0, 0, 0, 6.38723, 153.2928, 0, 606.0),
  body('ceres', 'Ceres', 'dwarf-planet', 'sun', 413_690_250, 0.0758, 10.593, 80.3055, 73.5977, 95.989, 1_680.0, 9.074, 4, 469.7),
];

const BODY_BY_ID = new Map<string, SolarBodyDefinition>(SOLAR_SYSTEM_BODIES.map((entry) => [entry.id, entry]));
const BODY_IDS = Object.freeze(SOLAR_SYSTEM_BODIES.map((entry) => entry.id));

export function getSolarSystemBody(id: string): SolarBodyDefinition | undefined {
  return BODY_BY_ID.get(id.toLowerCase());
}

export function solarSystemBodyIds(): readonly string[] {
  return BODY_IDS;
}

function createState(): OrbitalMotionState {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: 0,
    angularVelocity: 0,
  };
}

/**
 * Create one reusable evaluator. `parentState` should be the already-updated
 * parent body at the same time and in the same reference plane. For moons
 * rendered in a tilted parent-equator container, omit parentState and let the
 * scene graph supply the parent transform. No allocation occurs in update().
 */
export function createOrbitalMotion(
  definition: SolarBodyDefinition,
  options: OrbitalMotionOptions = {},
): OrbitalMotion {
  const state = createState();
  const distanceScale = Number.isFinite(options.distanceScale) ? (options.distanceScale as number) : 1;
  const epochSeconds = Number.isFinite(options.epochSeconds) ? (options.epochSeconds as number) : 0;
  const inclination = definition.inclinationDeg * radians;
  const ascendingNode = definition.ascendingNodeDeg * radians;
  const argument = definition.argumentOfPeriapsisDeg * radians;
  const initialMeanAnomaly = definition.meanAnomalyDeg * radians;
  const eccentricity = Math.min(0.999999, Math.max(0, definition.eccentricity));
  const semiMajorAxis = (definition.semiMajorAxisKm / ASTRONOMICAL_UNIT_KM) * distanceScale;
  const orbitPeriodSeconds = definition.orbitalPeriodDays * 86_400;
  const meanMotion = orbitPeriodSeconds > 0 ? TWO_PI / orbitPeriodSeconds : 0;
  // Rounded published rotation periods must not slowly de-synchronise a
  // tidally locked moon: use its exact orbital period for the mean spin.
  const rotationPeriodSeconds = definition.tidallyLocked
    ? orbitPeriodSeconds : Math.abs(definition.rotationPeriodHours) * 3_600;
  const signedRotation = definition.localRotationSign;

  // Precompute the fixed ecliptic-to-world rotation matrix coefficients.
  const cosNode = Math.cos(ascendingNode);
  const sinNode = Math.sin(ascendingNode);
  const cosInclination = Math.cos(inclination);
  const sinInclination = Math.sin(inclination);
  const cosArgument = Math.cos(argument);
  const sinArgument = Math.sin(argument);
  const r11 = cosNode * cosArgument - sinNode * sinArgument * cosInclination;
  const r12 = -cosNode * sinArgument - sinNode * cosArgument * cosInclination;
  const r21 = sinNode * cosArgument + cosNode * sinArgument * cosInclination;
  const r22 = -sinNode * sinArgument + cosNode * cosArgument * cosInclination;
  const r31 = sinArgument * sinInclination;
  const r32 = cosArgument * sinInclination;

  const update = (timeSeconds: number, parentState?: Readonly<OrbitalMotionState>) => {
    const elapsed = Number.isFinite(timeSeconds) ? timeSeconds - epochSeconds : 0;
    let px = 0;
    let py = 0;
    let pz = 0;
    let vx = 0;
    let vy = 0;
    let vz = 0;

    if (semiMajorAxis > 0 && orbitPeriodSeconds > 0) {
      let meanAnomaly = initialMeanAnomaly + meanMotion * elapsed;
      meanAnomaly %= TWO_PI;
      // Fixed iteration count avoids temporary arrays and converges rapidly
      // for every listed body (including Pluto's eccentric orbit).
      let eccentricAnomaly = meanAnomaly;
      for (let iteration = 0; iteration < 8; iteration += 1) {
        eccentricAnomaly -= (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly)
          / (1 - eccentricity * Math.cos(eccentricAnomaly));
      }
      const cosE = Math.cos(eccentricAnomaly);
      const sinE = Math.sin(eccentricAnomaly);
      const root = Math.sqrt(1 - eccentricity * eccentricity);
      const planeX = semiMajorAxis * (cosE - eccentricity);
      const planeY = semiMajorAxis * root * sinE;
      const dEdt = meanMotion / (1 - eccentricity * cosE);
      const planeVx = -semiMajorAxis * sinE * dEdt;
      const planeVy = semiMajorAxis * root * cosE * dEdt;
      px = r11 * planeX + r12 * planeY;
      py = r31 * planeX + r32 * planeY;
      pz = -(r21 * planeX + r22 * planeY);
      vx = r11 * planeVx + r12 * planeVy;
      vy = r31 * planeVx + r32 * planeVy;
      vz = -(r21 * planeVx + r22 * planeVy);
    }

    if (parentState) {
      px += parentState.position.x;
      py += parentState.position.y;
      pz += parentState.position.z;
      vx += parentState.velocity.x;
      vy += parentState.velocity.y;
      vz += parentState.velocity.z;
    }
    state.position.x = px;
    state.position.y = py;
    state.position.z = pz;
    state.velocity.x = vx;
    state.velocity.y = vy;
    state.velocity.z = vz;

    if (rotationPeriodSeconds > 0) {
      const rotationElapsed = elapsed % rotationPeriodSeconds;
      state.angularVelocity = signedRotation * TWO_PI / rotationPeriodSeconds;
      state.rotation = (rotationElapsed * state.angularVelocity) % TWO_PI;
    } else {
      state.angularVelocity = 0;
      state.rotation = 0;
    }
  };

  return { body: definition, state, update };
}
