import { addDays, format, getDay, parseISO } from "date-fns";

export type InflowRow = {
  id?: string;
  inflow_date: string;
  actual_count: number | null;
  predicted_count: number;
  source: string;
  notes: string | null;
};

/**
 * AI-lite forecast: predicts patient inflow for a target date by averaging
 * historical actual counts for the same day-of-week over the last `lookbackWeeks`.
 * Falls back to the overall mean if no same-day history exists.
 */
export function predictInflow(
  history: InflowRow[],
  targetDate: string,
  lookbackWeeks = 8,
): { predicted: number; confidence: number; basis: string } {
  const target = parseISO(targetDate);
  const targetDay = getDay(target);
  const targetStr = format(target, "yyyy-MM-dd");

  const byDate = new Map(history.map((h) => [h.inflow_date, h]));
  const sameDayHistory: number[] = [];

  for (let w = 1; w <= lookbackWeeks; w++) {
    const past = format(addDays(target, -7 * w), "yyyy-MM-dd");
    const row = byDate.get(past);
    if (row && typeof row.actual_count === "number") {
      sameDayHistory.push(row.actual_count);
    }
  }

  if (sameDayHistory.length >= 2) {
    const avg = Math.round(sameDayHistory.reduce((a, b) => a + b, 0) / sameDayHistory.length);
    const variance =
      sameDayHistory.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / sameDayHistory.length;
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0, Math.min(100, Math.round(100 - stdDev * 2)));
    return { predicted: avg, confidence, basis: `Avg of last ${sameDayHistory.length} ${dayName(targetDay)}s` };
  }

  const allActuals = history
    .filter((h) => typeof h.actual_count === "number")
    .map((h) => h.actual_count as number);

  if (allActuals.length === 0) {
    return { predicted: 50, confidence: 30, basis: "Default baseline (no history)" };
  }

  const avg = Math.round(allActuals.reduce((a, b) => a + b, 0) / allActuals.length);
  return { predicted: avg, confidence: 50, basis: "Overall historical average" };
}

function dayName(day: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day];
}

/**
 * Recommended staffing ratios (patients per staff member).
 * These can be tuned by hospital policy.
 */
export const STAFFING_RATIOS = {
  patientsPerDoctor: 15,
  patientsPerNurse: 8,
};

export function recommendedStaffing(predictedPatients: number) {
  return {
    doctors: Math.max(1, Math.ceil(predictedPatients / STAFFING_RATIOS.patientsPerDoctor)),
    nurses: Math.max(1, Math.ceil(predictedPatients / STAFFING_RATIOS.patientsPerNurse)),
  };
}

/**
 * Generates a 7-day forecast starting from the given date, updating
 * predicted rows where missing.
 */
export function generateForecast(
  history: InflowRow[],
  startDate: string,
  days = 7,
): InflowRow[] {
  const start = parseISO(startDate);
  const forecast: InflowRow[] = [];
  const byDate = new Map(history.map((h) => [h.inflow_date, h]));

  for (let i = 0; i < days; i++) {
    const date = format(addDays(start, i), "yyyy-MM-dd");
    const existing = byDate.get(date);
    if (existing && existing.source !== "forecast" && typeof existing.actual_count === "number") {
      forecast.push(existing);
      continue;
    }
    const prediction = predictInflow(history, date);
    forecast.push({
      id: existing?.id,
      inflow_date: date,
      actual_count: existing?.actual_count ?? null,
      predicted_count: prediction.predicted,
      source: "forecast",
      notes: existing?.notes ?? null,
    });
  }

  return forecast;
}
