/**
 * Periodic Heat Flow & Thermal Inertia Calculation Engine
 * 
 * Implements fundamental architectural climatology & building physics formulations:
 * - Thermal Diffusivity: K = k / (d * c)
 * - Daily Average Heat Flow: Q_a = A * U * (T_sa,m - T_i)
 * - Momentary Deviation: sQ_c(t) = A * U * mu * (T_sa,t-phi - T_sa,m)
 * - Total Momentary Heat Flow: Q_c(t) = Q_a + sQ_c(t)
 */

export interface PeriodicElementInput {
  name: string;
  orientation: string; // N, S, E, W, Roof, Floor
  area: number;        // Surface Area A (m^2)
  uValue: number;      // Thermal Transmittance U (W/m^2*C)
  timeLag: number;     // Time lag phi (hours)
  decrementFactor: number; // Amplitude attenuation mu (0 to 1)
  solAirTemps?: number[];  // Optional 24-hr profile (C)
}

export interface HourlyHeatPoint {
  hour: number;          // 0 to 23
  solAirTemp: number;    // T_sa at hour t
  laggedSolAir: number;  // T_sa at hour (t - phi)
  momentaryDev: number;  // sQ_c in Watts
  totalHeatFlow: number; // Q_c in Watts
  steadyStateHeat: number; // A * U * (T_sa - T_i) without thermal mass
}

export interface ElementPeriodicResult {
  name: string;
  orientation: string;
  area: number;
  uValue: number;
  timeLag: number;
  decrementFactor: number;
  meanSolAirTemp: number; // T_sa,m (C)
  dailyAvgHeat: number;   // Q_a (Watts)
  peakHeatFlow: number;   // Max Q_c (Watts)
  peakHour: number;       // Hour of max Q_c (0-23)
  peakSteadyHeat: number; // Peak without thermal mass (Watts)
  loadReductionPct: number; // Damping %
  hourlyResults: HourlyHeatPoint[];
}

export interface EnvelopeHourlySummary {
  hour: number;
  totalPeriodic: number; // Sum of Q_c in Watts
  totalSteady: number;   // Sum of steady-state in Watts
}

export interface PeriodicSimulationResult {
  indoorTemp: number;
  dailyAvgEnvelopeHeat: number; // Total Q_a (Watts)
  peakEnvelopeHeat: number;     // Max envelope Q_c (Watts)
  peakEnvelopeHour: number;     // Hour of combined peak
  peakSteadyEnvelope: number;   // Max envelope steady-state (Watts)
  envelopeDampingPct: number;   // Peak reduction % due to thermal mass
  dailyEnergyKWh: number;       // Total positive daily energy (kWh)
  hourlySummary: EnvelopeHourlySummary[];
  elements: ElementPeriodicResult[];
}

/**
 * Calculates Thermal Diffusivity K = k / (d * c) in m^2/s
 * @param k Thermal Conductivity (W/m*C)
 * @param d Density (kg/m^3)
 * @param c Specific Heat Capacity (J/kg*C)
 */
export function calculateDiffusivity(k: number, d: number, c: number): number {
  if (d <= 0 || c <= 0) return 0;
  return k / (d * c);
}

/**
 * Generates a realistic 24-hour diurnal sol-air temperature curve
 * Peak solar radiation occurs around 14:00 - 15:00
 */
export function generateDefaultSolAirProfile(tMean: number = 32, amplitude: number = 8): number[] {
  const profile: number[] = [];
  for (let h = 0; h < 24; h++) {
    const rad = (2 * Math.PI * (h - 15)) / 24;
    const temp = tMean + amplitude * Math.cos(rad);
    profile.push(parseFloat(temp.toFixed(2)));
  }
  return profile;
}

/**
 * Sol-Air profile synthesized with orientation solar radiation factors
 */
export function generateOrientationSolAirProfile(
  orientation: string,
  tMean: number = 32,
  tRange: number = 10,
  G_peak: number = 600,
  alpha: number = 0.6,
  rso: number = 0.05
): number[] {
  const profile: number[] = [];
  const halfRange = tRange / 2;

  // Solar exposure multiplier and peak hour by orientation
  let solarPeakHour = 13;
  let orientationFactor = 0.5;

  switch (orientation.toUpperCase()) {
    case 'E':
    case 'WALL 2':
      solarPeakHour = 9; // Morning sun
      orientationFactor = 0.75;
      break;
    case 'S':
    case 'WALL 3':
      solarPeakHour = 12; // Noon sun
      orientationFactor = 0.85;
      break;
    case 'W':
    case 'WALL 4':
      solarPeakHour = 16; // Afternoon severe sun
      orientationFactor = 0.90;
      break;
    case 'N':
    case 'WALL 1':
      solarPeakHour = 12; // Diffuse / low direct
      orientationFactor = 0.25;
      break;
    case 'ROOF':
      solarPeakHour = 13; // Maximum unobstructed exposure
      orientationFactor = 1.0;
      break;
    default:
      solarPeakHour = 13;
      orientationFactor = 0.5;
  }

  for (let h = 0; h < 24; h++) {
    // Diurnal ambient dry-bulb temperature (minimum around 5:00, maximum around 15:00)
    const dryBulbRad = (2 * Math.PI * (h - 15)) / 24;
    const tOutdoor = tMean + halfRange * Math.cos(dryBulbRad);

    // Solar radiation curve during daylight hours (6:00 to 18:00)
    let solarGain = 0;
    if (h >= 6 && h <= 18) {
      const solarRad = (Math.PI * (h - 6)) / 12;
      const hourShift = Math.max(0, 1 - Math.abs(h - solarPeakHour) / 6);
      const intensity = G_peak * orientationFactor * Math.sin(solarRad) * hourShift;
      solarGain = intensity * alpha * rso;
    }

    const tSolAir = tOutdoor + solarGain;
    profile.push(parseFloat(tSolAir.toFixed(2)));
  }

  return profile;
}

/**
 * Continuous cyclical lookback interpolation for fractional time lags (e.g. 5.8 hours)
 */
export function getLaggedTemp(profile: number[], hour: number, phi: number): number {
  const n = profile.length;
  if (n === 0) return 0;

  let exactHour = hour - phi;
  while (exactHour < 0) exactHour += n;
  while (exactHour >= n) exactHour -= n;

  const h0 = Math.floor(exactHour) % n;
  const h1 = (h0 + 1) % n;
  const frac = exactHour - Math.floor(exactHour);

  return (1 - frac) * profile[h0] + frac * profile[h1];
}

/**
 * Calculates Periodic Diurnal Heat Flow across all envelope elements
 */
export function calculatePeriodicHeatFlow(
  indoorTemp: number,
  elements: PeriodicElementInput[],
  defaultProfile?: number[]
): PeriodicSimulationResult {
  const baseProfile = defaultProfile && defaultProfile.length === 24 
    ? defaultProfile 
    : generateDefaultSolAirProfile(32, 8);

  const elementResults: ElementPeriodicResult[] = [];
  const hourlyCombinedPeriodic: number[] = new Array(24).fill(0);
  const hourlyCombinedSteady: number[] = new Array(24).fill(0);
  let totalDailyAvgHeat = 0;

  for (const el of elements) {
    const profile = el.solAirTemps && el.solAirTemps.length === 24 
      ? el.solAirTemps 
      : baseProfile;

    // Daily Mean Sol-Air Temperature: T_sa,m = (1/24) * sum(T_sa)
    const sumTsa = profile.reduce((acc, v) => acc + v, 0);
    const tsam = sumTsa / profile.length;

    // 1. Daily Average Heat Flow: Q_a = A * U * (T_sa,m - T_i)
    const qa = el.area * el.uValue * (tsam - indoorTemp);
    totalDailyAvgHeat += qa;

    const hourlyPoints: HourlyHeatPoint[] = [];
    let maxQc = -Infinity;
    let maxSteady = -Infinity;
    let peakHour = 0;

    for (let h = 0; h < 24; h++) {
      const tsaH = profile[h];
      const tsaLagged = getLaggedTemp(profile, h, el.timeLag);

      // 2. Momentary Deviation: sQ_c = A * U * mu * (T_sa,t-phi - T_sa,m)
      const sqc = el.area * el.uValue * el.decrementFactor * (tsaLagged - tsam);

      // 3. Total Momentary Heat Flow: Q_c = Q_a + sQ_c
      const qc = qa + sqc;

      // Steady state reference (without thermal mass damping)
      const qSteady = el.area * el.uValue * (tsaH - indoorTemp);

      if (qc > maxQc) {
        maxQc = qc;
        peakHour = h;
      }
      if (qSteady > maxSteady) {
        maxSteady = qSteady;
      }

      hourlyCombinedPeriodic[h] += qc;
      hourlyCombinedSteady[h] += qSteady;

      hourlyPoints.push({
        hour: h,
        solAirTemp: parseFloat(tsaH.toFixed(2)),
        laggedSolAir: parseFloat(tsaLagged.toFixed(2)),
        momentaryDev: parseFloat(sqc.toFixed(2)),
        totalHeatFlow: parseFloat(qc.toFixed(2)),
        steadyStateHeat: parseFloat(qSteady.toFixed(2))
      });
    }

    const reductionPct = maxSteady > 0 
      ? Math.max(0, (1 - maxQc / maxSteady) * 100) 
      : 0;

    elementResults.push({
      name: el.name,
      orientation: el.orientation,
      area: parseFloat(el.area.toFixed(3)),
      uValue: parseFloat(el.uValue.toFixed(4)),
      timeLag: el.timeLag,
      decrementFactor: el.decrementFactor,
      meanSolAirTemp: parseFloat(tsam.toFixed(2)),
      dailyAvgHeat: parseFloat(qa.toFixed(2)),
      peakHeatFlow: parseFloat(maxQc.toFixed(2)),
      peakHour,
      peakSteadyHeat: parseFloat(maxSteady.toFixed(2)),
      loadReductionPct: parseFloat(reductionPct.toFixed(1)),
      hourlyResults: hourlyPoints
    });
  }

  // Aggregate Envelope Totals
  const hourlySummary: EnvelopeHourlySummary[] = [];
  let maxEnvPeriodic = -Infinity;
  let maxEnvSteady = -Infinity;
  let peakEnvHour = 0;
  let totalWattHours = 0;

  for (let h = 0; h < 24; h++) {
    const pVal = hourlyCombinedPeriodic[h];
    const sVal = hourlyCombinedSteady[h];

    if (pVal > maxEnvPeriodic) {
      maxEnvPeriodic = pVal;
      peakEnvHour = h;
    }
    if (sVal > maxEnvSteady) {
      maxEnvSteady = sVal;
    }
    if (pVal > 0) {
      totalWattHours += pVal;
    }

    hourlySummary.push({
      hour: h,
      totalPeriodic: parseFloat(pVal.toFixed(2)),
      totalSteady: parseFloat(sVal.toFixed(2))
    });
  }

  const overallDampingPct = maxEnvSteady > 0 
    ? Math.max(0, (1 - maxEnvPeriodic / maxEnvSteady) * 100) 
    : 0;

  return {
    indoorTemp,
    dailyAvgEnvelopeHeat: parseFloat(totalDailyAvgHeat.toFixed(2)),
    peakEnvelopeHeat: parseFloat(maxEnvPeriodic.toFixed(2)),
    peakEnvelopeHour: peakEnvHour,
    peakSteadyEnvelope: parseFloat(maxEnvSteady.toFixed(2)),
    envelopeDampingPct: parseFloat(overallDampingPct.toFixed(1)),
    dailyEnergyKWh: parseFloat((totalWattHours / 1000).toFixed(2)),
    hourlySummary,
    elements: elementResults
  };
}

