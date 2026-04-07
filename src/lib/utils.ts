import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { TestItem, TestResult } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const generateMockResults = (
  sampleId: string, 
  testItems: TestItem[], 
  projectSpecs?: Record<string, { min?: number; max?: number; target?: number }>
): TestResult[] => {
  return testItems.map(item => {
    const spec = projectSpecs?.[item.id];
    const target = spec?.target ?? (item as any).targetValue ?? 100;
    const min = spec?.min ?? (item as any).specMin;
    const max = spec?.max ?? (item as any).specMax;
    
    // Generate raw values centered around the target
    const rawValues = Array.from({ length: 3 }, () => target + (Math.random() - 0.5) * (target * 0.1));
    const mean = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;
    const isAnomaly = (min !== undefined && mean < min) || (max !== undefined && mean > max);
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      sampleId,
      testItemId: item.id,
      rawValues,
      mean,
      stdDev: Math.sqrt(rawValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / rawValues.length),
      max: Math.max(...rawValues),
      min: Math.min(...rawValues),
      isAnomaly,
      status: isAnomaly ? 'Fail' : 'Pass',
    };
  });
};
