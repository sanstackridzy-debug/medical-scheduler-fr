export const SHIFT_TYPES = ["on_call", "ward_duty", "opd", "surgery", "er"] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];
export const SHIFT_PERIODS = ["morning", "afternoon", "night"] as const;
export type ShiftPeriod = (typeof SHIFT_PERIODS)[number];

export const shiftTypeLabel: Record<ShiftType, string> = {
  on_call: "On-call",
  ward_duty: "Ward Duty",
  opd: "OPD",
  surgery: "Surgery",
  er: "ER",
};

export const shiftPeriodLabel: Record<ShiftPeriod, string> = {
  morning: "Morning (07:00–15:00)",
  afternoon: "Afternoon (15:00–23:00)",
  night: "Night (23:00–07:00)",
};

export const shiftPeriodShort: Record<ShiftPeriod, string> = {
  morning: "AM",
  afternoon: "PM",
  night: "Night",
};

export const shiftTypeClass: Record<ShiftType, string> = {
  on_call: "bg-[--shift-oncall] text-white",
  ward_duty: "bg-[--shift-ward] text-white",
  opd: "bg-[--shift-opd] text-white",
  surgery: "bg-[--shift-surgery] text-white",
  er: "bg-[--shift-er] text-white",
};

export function periodHours(p: ShiftPeriod): { start: string; end: string } {
  switch (p) {
    case "morning": return { start: "07:00", end: "15:00" };
    case "afternoon": return { start: "15:00", end: "23:00" };
    case "night": return { start: "23:00", end: "07:00" };
  }
}

/** Returns true if a doctor is on duty at the given date/time based on shifts. */
export function isDoctorOnDuty(shifts: { shift_date: string; period: ShiftPeriod }[], date: string, hhmm: string) {
  const [h] = hhmm.split(":").map(Number);
  const hour = h;
  return shifts.some((s) => {
    if (s.shift_date !== date) return false;
    if (s.period === "morning") return hour >= 7 && hour < 15;
    if (s.period === "afternoon") return hour >= 15 && hour < 23;
    // night: 23:00-07:00 next day - handle same-day 23+ only (simplification)
    return hour >= 23;
  });
}
