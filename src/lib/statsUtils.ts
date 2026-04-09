/**
 * Statistical utility functions for quality control and process analysis.
 */

export interface StatsResult {
  mean: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  count: number;
}

export interface CapabilityResult {
  cp: number;
  cpk: number;
  cpu: number;
  cpl: number;
}

export enum NelsonRule {
  RULE_1 = 'R1: Point outside 3-sigma',
  RULE_2 = 'R2: 9 points in a row on same side of mean',
  RULE_3 = 'R3: 6 points in a row steadily increasing or decreasing',
  RULE_4 = 'R4: 14 points in a row alternating up and down',
  RULE_5 = 'R5: 2 out of 3 points > 2-sigma on same side',
  RULE_6 = 'R6: 4 out of 5 points > 1-sigma on same side',
  RULE_7 = 'R7: 15 points in a row within 1-sigma',
  RULE_8 = 'R8: 8 points in a row > 1-sigma on both sides',
}

export interface RuleViolation {
  rule: NelsonRule;
  index: number; // The index of the point that triggered the rule
  points: number[]; // The indices of all points involved in the violation
}

/**
 * Calculates basic statistics for a numeric array.
 */
export const calculateStats = (values: number[]): StatsResult => {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, variance: 0, min: 0, max: 0, range: 0, count: 0 };
  }

  const count = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const mean = values.reduce((a, b) => a + b, 0) / count;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (count - 1 || 1);
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, variance, min, max, range, count };
};

/**
 * Calculates Cp and Cpk given stats and specifications.
 */
export const calculateCapability = (
  stats: StatsResult,
  specMin?: number,
  specMax?: number
): CapabilityResult => {
  const { mean, stdDev } = stats;
  
  if (stdDev === 0) return { cp: 0, cpk: 0, cpu: 0, cpl: 0 };

  let cpu = Infinity;
  let cpl = Infinity;

  if (specMax !== undefined) {
    cpu = (specMax - mean) / (3 * stdDev);
  }

  if (specMin !== undefined) {
    cpl = (mean - specMin) / (3 * stdDev);
  }

  const cpk = Math.max(0, Math.min(cpu, cpl));
  const cp = (specMax !== undefined && specMin !== undefined) 
    ? (specMax - specMin) / (6 * stdDev) 
    : 0;

  return { 
    cp: isFinite(cp) ? cp : 0, 
    cpk: isFinite(cpk) ? cpk : 0, 
    cpu: isFinite(cpu) ? cpu : 0, 
    cpl: isFinite(cpl) ? cpl : 0 
  };
};

/**
 * Detects Nelson Rules violations in a sequence of points.
 */
export const detectNelsonRules = (values: number[], mean: number, stdDev: number): RuleViolation[] => {
  const violations: RuleViolation[] = [];
  if (values.length === 0 || stdDev === 0) return [];

  const sigma1 = 1 * stdDev;
  const sigma2 = 2 * stdDev;
  const sigma3 = 3 * stdDev;

  values.forEach((val, i) => {
    // Rule 1: One point is more than 3 standard deviations from the mean.
    if (Math.abs(val - mean) > sigma3) {
      violations.push({ rule: NelsonRule.RULE_1, index: i, points: [i] });
    }

    // Rule 2: Nine (or more) points in a row are on the same side of the mean.
    if (i >= 8) {
      const last9 = values.slice(i - 8, i + 1);
      const allAbove = last9.every(v => v > mean);
      const allBelow = last9.every(v => v < mean);
      if (allAbove || allBelow) {
        violations.push({ rule: NelsonRule.RULE_2, index: i, points: Array.from({length: 9}, (_, k) => i - 8 + k) });
      }
    }

    // Rule 3: Six (or more) points in a row are continually increasing (or decreasing).
    if (i >= 5) {
      const last6 = values.slice(i - 5, i + 1);
      let increasing = true;
      let decreasing = true;
      for (let k = 1; k < 6; k++) {
        if (last6[k] <= last6[k-1]) increasing = false;
        if (last6[k] >= last6[k-1]) decreasing = false;
      }
      if (increasing || decreasing) {
        violations.push({ rule: NelsonRule.RULE_3, index: i, points: Array.from({length: 6}, (_, k) => i - 5 + k) });
      }
    }

    // Rule 4: Fourteen (or more) points in a row alternate in direction, increasing then decreasing.
    if (i >= 13) {
      const last14 = values.slice(i - 13, i + 1);
      let alternating = true;
      for (let k = 1; k < 14; k++) {
        const diff = last14[k] - last14[k-1];
        const prevDiff = k > 1 ? last14[k-1] - last14[k-2] : 0;
        if (k > 1 && ((diff > 0 && prevDiff > 0) || (diff < 0 && prevDiff < 0) || diff === 0)) {
          alternating = false;
          break;
        }
      }
      if (alternating) {
        violations.push({ rule: NelsonRule.RULE_4, index: i, points: Array.from({length: 14}, (_, k) => i - 13 + k) });
      }
    }

    // Rule 5: Two (or three) out of three points in a row are more than 2 standard deviations from the mean in the same direction.
    if (i >= 2) {
      const last3 = values.slice(i - 2, i + 1);
      const above2s = last3.filter(v => v > mean + sigma2).length;
      const below2s = last3.filter(v => v < mean - sigma2).length;
      if (above2s >= 2 || below2s >= 2) {
        violations.push({ rule: NelsonRule.RULE_5, index: i, points: Array.from({length: 3}, (_, k) => i - 2 + k) });
      }
    }

    // Rule 6: Four (or five) out of five points in a row are more than 1 standard deviation from the mean in the same direction.
    if (i >= 4) {
      const last5 = values.slice(i - 4, i + 1);
      const above1s = last5.filter(v => v > mean + sigma1).length;
      const below1s = last5.filter(v => v < mean - sigma1).length;
      if (above1s >= 4 || below1s >= 4) {
        violations.push({ rule: NelsonRule.RULE_6, index: i, points: Array.from({length: 5}, (_, k) => i - 4 + k) });
      }
    }

    // Rule 7: Fifteen points in a row are all within 1 standard deviation of the mean on either side of the mean.
    if (i >= 14) {
      const last15 = values.slice(i - 14, i + 1);
      const allWithin1s = last15.every(v => Math.abs(v - mean) <= sigma1);
      if (allWithin1s) {
        violations.push({ rule: NelsonRule.RULE_7, index: i, points: Array.from({length: 15}, (_, k) => i - 14 + k) });
      }
    }

    // Rule 8: Eight points in a row exist with none within 1 standard deviation of the mean and the points are in both directions from the mean.
    if (i >= 7) {
      const last8 = values.slice(i - 7, i + 1);
      const noneWithin1s = last8.every(v => Math.abs(v - mean) > sigma1);
      const hasAbove = last8.some(v => v > mean);
      const hasBelow = last8.some(v => v < mean);
      if (noneWithin1s && hasAbove && hasBelow) {
        violations.push({ rule: NelsonRule.RULE_8, index: i, points: Array.from({length: 8}, (_, k) => i - 7 + k) });
      }
    }
  });

  return violations;
};

/**
 * Generates data for a normal distribution curve.
 */
export const generateNormalCurve = (mean: number, stdDev: number, min: number, max: number, steps: number = 50) => {
  const data = [];
  const range = max - min;
  const stepSize = range / steps;

  for (let i = 0; i <= steps; i++) {
    const x = min + i * stepSize;
    // Normal distribution formula: (1 / (sigma * sqrt(2 * pi))) * exp(-0.5 * ((x - mu) / sigma)^2)
    const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
    data.push({ x, y });
  }

  return data;
};

/**
 * Groups values into bins for a histogram.
 */
export const generateHistogramData = (values: number[], binCount: number = 10) => {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const binWidth = range / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    count: 0,
    label: `${(min + i * binWidth).toFixed(2)} - ${(min + (i + 1) * binWidth).toFixed(2)}`
  }));

  values.forEach(val => {
    let binIndex = Math.floor((val - min) / binWidth);
    if (binIndex === binCount) binIndex--; // Handle the max value
    if (bins[binIndex]) {
      bins[binIndex].count++;
    }
  });

  return bins;
};

/**
 * Calculates linear regression (y = mx + b).
 */
export const calculateLinearRegression = (data: { x: number; y: number }[]) => {
  if (data.length < 2) return { m: 0, b: 0, r: 0 };

  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (const p of data) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denominator = (n * sumX2 - sumX * sumX);
  if (denominator === 0) return { m: 0, b: 0, r: 0 };

  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;

  // Pearson correlation coefficient
  const rNumerator = (n * sumXY - sumX * sumY);
  const rDenominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const r = rDenominator === 0 ? 0 : rNumerator / rDenominator;

  return { m, b, r };
};
