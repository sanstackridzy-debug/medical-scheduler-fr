import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";
import type { ShiftPeriod, ShiftType } from "./shift-utils";

export type AvailabilityStatus = "available" | "unavailable" | "preferred";


export type StaffRow = {
  id: string;
  full_name?: string;
  role: string;
};

export type StaffSkill = {
  user_id: string;
  skill_id: string;
  expires_at: string | null;
};

export type SkillRequirement = {
  shift_type: ShiftType;
  skill_id: string;
  required_count: number;
};

export type AvailabilityRow = {
  user_id: string;
  availability_date: string;
  status: AvailabilityStatus;
};

export type ExistingShift = {
  staff_id: string;
  shift_date: string;
  period: ShiftPeriod;
};

export type ShiftRule = {
  name: string;
  rule_type:
    | "max_nights_per_month"
    | "max_consecutive_days"
    | "min_rest_hours"
    | "max_weekends_per_month"
    | "max_hours_per_week";
  value: number;
  is_active: boolean;
};


export type GeneratedShift = {
  staff_id: string;
  shift_date: string;
  period: ShiftPeriod;
  type: ShiftType;
  score: number;
  warnings: string[];
};

export type ScheduleResult = {
  shifts: GeneratedShift[];
  fairness: {
    averageShiftsPerStaff: number;
    stdDeviation: number;
    nightShiftBalance: number;
    weekendShiftBalance: number;
  };
  violations: RuleViolation[];
  uncovered: { shift_date: string; period: ShiftPeriod; type: ShiftType; reason: string }[];
};

export type RuleViolation = {
  staff_id: string;
  staff_name?: string;
  rule: string;
  message: string;
  severity: "warning" | "critical";
};

const PERIOD_HOURS: Record<ShiftPeriod, number> = {
  morning: 8,
  afternoon: 8,
  night: 8,
};

const PERIOD_ORDER: ShiftPeriod[] = ["morning", "afternoon", "night"];

export function buildSchedule(
  start: string,
  end: string,
  periods: ShiftPeriod[],
  shiftTypes: ShiftType[],
  weekdays: number[],
  staff: StaffRow[],
  staffSkills: StaffSkill[],
  skillRequirements: SkillRequirement[],
  availability: AvailabilityRow[],
  existingShifts: ExistingShift[],
  rules: ShiftRule[],
  perShift: number,
): ScheduleResult {
  const s = parseISO(start);
  const e = parseISO(end);
  if (differenceInCalendarDays(e, s) < 0) throw new Error("End date must be after start date");

  const allShifts: GeneratedShift[] = [];
  const uncovered: ScheduleResult["uncovered"] = [];

  // Pre-index data
  const skillSetByStaff = new Map<string, Set<string>>();
  for (const ss of staffSkills) {
    if (ss.expires_at && ss.expires_at < start) continue;
    const set = skillSetByStaff.get(ss.user_id) ?? new Set();
    set.add(ss.skill_id);
    skillSetByStaff.set(ss.user_id, set);
  }

  const skillsRequiredByType = new Map<ShiftType, Map<string, number>>();
  for (const req of skillRequirements) {
    const map = skillsRequiredByType.get(req.shift_type) ?? new Map();
    map.set(req.skill_id, req.required_count);
    skillsRequiredByType.set(req.shift_type, map);
  }

  const availabilityByStaffDate = new Map<string, Map<string, AvailabilityStatus>>();
  for (const a of availability) {
    const dateMap = availabilityByStaffDate.get(a.user_id) ?? new Map();
    dateMap.set(a.availability_date, a.status);
    availabilityByStaffDate.set(a.user_id, dateMap);
  }

  const existingByStaffDatePeriod = new Map<string, Map<string, Set<string>>>();
  for (const ex of existingShifts) {
    const dateMap: Map<string, Set<string>> = existingByStaffDatePeriod.get(ex.staff_id) ?? new Map();
    const periodSet: Set<string> = dateMap.get(ex.shift_date) ?? new Set();
    periodSet.add(ex.period);
    dateMap.set(ex.shift_date, periodSet);
    existingByStaffDatePeriod.set(ex.staff_id, dateMap);
  }


  // Running state for fairness
  const assignedShifts: GeneratedShift[] = [];

  for (let d = s; differenceInCalendarDays(e, d) >= 0; d = addDays(d, 1)) {
    if (!weekdays.includes(getDay(d))) continue;
    const date = format(d, "yyyy-MM-dd");
    const isWeekend = getDay(d) === 0 || getDay(d) === 6;

    for (const type of shiftTypes) {
      for (const period of periods) {
        for (let i = 0; i < perShift; i++) {
          const candidates = staff
            .map((s) => {
              const score = scoreCandidate(
                s,
                date,
                period,
                type,
                skillSetByStaff,
                skillsRequiredByType,
                availabilityByStaffDate,
                existingByStaffDatePeriod,
                assignedShifts,
                isWeekend,
              );
              return { staff: s, score };
            })
            .filter((c) => c.score !== null)
            .sort((a, b) => (b.score as number) - (a.score as number));

          if (candidates.length === 0) {
            uncovered.push({ shift_date: date, period, type, reason: "No eligible staff" });
            continue;
          }

          const chosen = candidates[0].staff;
          const shift: GeneratedShift = {
            staff_id: chosen.id,
            shift_date: date,
            period,
            type,
            score: candidates[0].score as number,
            warnings: [],
          };

          assignedShifts.push(shift);
          allShifts.push(shift);

          // Update running state
          const dateMap: Map<string, Set<string>> = existingByStaffDatePeriod.get(chosen.id) ?? new Map();
          const periodSet: Set<string> = dateMap.get(date) ?? new Set();
          periodSet.add(period);
          dateMap.set(date, periodSet);
          existingByStaffDatePeriod.set(chosen.id, dateMap);

        }
      }
    }
  }

  const violations = checkViolations(allShifts, staff, rules);
  const fairness = calculateFairness(allShifts, staff);

  return { shifts: allShifts, fairness, violations, uncovered };
}

function scoreCandidate(
  staff: StaffRow,
  date: string,
  period: ShiftPeriod,
  type: ShiftType,
  skillSetByStaff: Map<string, Set<string>>,
  skillsRequiredByType: Map<ShiftType, Map<string, number>>,
  availabilityByStaffDate: Map<string, Map<string, AvailabilityStatus>>,
  assignedByStaffDatePeriod: Map<string, Map<string, Set<string>>>,
  assignedShifts: GeneratedShift[],
  isWeekend: boolean,
): number | null {
  // Hard constraints
  const availability = availabilityByStaffDate.get(staff.id)?.get(date);
  if (availability === "unavailable") return null;

  const requiredSkills = skillsRequiredByType.get(type);
  if (requiredSkills) {
    const staffSkillSet = skillSetByStaff.get(staff.id) ?? new Set();
    for (const [skillId, count] of requiredSkills.entries()) {
      if (!staffSkillSet.has(skillId)) return null;
    }
  }

  const dayPeriods = assignedByStaffDatePeriod.get(staff.id)?.get(date) ?? new Set();
  if (dayPeriods.has(period)) return null;

  let score = 100;

  // Preference bonus
  if (availability === "preferred") score += 25;

  // Workload balance (penalize staff already heavily assigned)
  const staffAssigned = assignedShifts.filter((s) => s.staff_id === staff.id).length;
  score -= staffAssigned * 8;

  // Night shift balance
  if (period === "night") {
    const recentNights = assignedShifts.filter(
      (s) => s.staff_id === staff.id && s.period === "night" && s.shift_date >= date,
    ).length;
    score -= recentNights * 15;
  }

  // Weekend balance
  if (isWeekend) {
    const recentWeekends = assignedShifts.filter(
      (s) => s.staff_id === staff.id && (new Date(s.shift_date).getDay() === 0 || new Date(s.shift_date).getDay() === 6),
    ).length;
    score -= recentWeekends * 10;
  }

  // Consecutive days penalty
  const consecutive = countConsecutiveDays(assignedByStaffDatePeriod, staff.id, date);
  score -= consecutive * 5;

  // Rest period: penalize night->morning or afternoon->night short rest
  const restHours = hoursOfRestBefore(assignedByStaffDatePeriod, staff.id, date, period);
  if (restHours !== null && restHours < 12) score -= 20;

  return score;
}

function countConsecutiveDays(
  assignedByStaffDatePeriod: Map<string, Map<string, Set<string>>>,
  staffId: string,
  date: string,
): number {
  const dateMap = assignedByStaffDatePeriod.get(staffId);
  if (!dateMap) return 0;

  let consecutive = 0;
  let d = new Date(date);
  d.setDate(d.getDate() - 1);
  while (true) {
    const dStr = format(d, "yyyy-MM-dd");
    if ((dateMap.get(dStr)?.size ?? 0) > 0) {
      consecutive++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return consecutive;
}

function hoursOfRestBefore(
  assignedByStaffDatePeriod: Map<string, Map<string, Set<string>>>,
  staffId: string,
  date: string,
  period: ShiftPeriod,
): number | null {
  const dateMap = assignedByStaffDatePeriod.get(staffId);
  if (!dateMap) return null;

  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  const prevStr = format(prev, "yyyy-MM-dd");
  const prevPeriods = dateMap.get(prevStr);
  if (!prevPeriods || prevPeriods.size === 0) return null;

  const endHourPrev = prevPeriods.has("night") ? 7 : prevPeriods.has("afternoon") ? 23 : 15;
  const startHourCurrent = period === "morning" ? 7 : period === "afternoon" ? 15 : 23;

  return 24 - endHourPrev + startHourCurrent;
}

export function calculateFairness(shifts: GeneratedShift[], staff: StaffRow[]) {
  const counts = new Map<string, number>();
  const nightCounts = new Map<string, number>();
  const weekendCounts = new Map<string, number>();

  for (const s of staff) counts.set(s.id, 0);
  for (const shift of shifts) {
    counts.set(shift.staff_id, (counts.get(shift.staff_id) ?? 0) + 1);
    if (shift.period === "night") nightCounts.set(shift.staff_id, (nightCounts.get(shift.staff_id) ?? 0) + 1);
    const day = new Date(shift.shift_date).getDay();
    if (day === 0 || day === 6) weekendCounts.set(shift.staff_id, (weekendCounts.get(shift.staff_id) ?? 0) + 1);
  }

  const values = Array.from(counts.values());
  const avg = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / Math.max(1, values.length);
  const stdDev = Math.sqrt(variance);

  const nightValues = Array.from(nightCounts.values());
  const nightAvg = nightValues.reduce((a, b) => a + b, 0) / Math.max(1, nightValues.length);
  const nightVariance = nightValues.reduce((sum, v) => sum + Math.pow(v - nightAvg, 2), 0) / Math.max(1, nightValues.length);
  const nightBalance = Math.max(0, 100 - Math.sqrt(nightVariance) * 20);

  const weekendValues = Array.from(weekendCounts.values());
  const weekendAvg = weekendValues.reduce((a, b) => a + b, 0) / Math.max(1, weekendValues.length);
  const weekendVariance = weekendValues.reduce((sum, v) => sum + Math.pow(v - weekendAvg, 2), 0) / Math.max(1, weekendValues.length);
  const weekendBalance = Math.max(0, 100 - Math.sqrt(weekendVariance) * 20);

  return {
    averageShiftsPerStaff: Number(avg.toFixed(2)),
    stdDeviation: Number(stdDev.toFixed(2)),
    nightShiftBalance: Number(nightBalance.toFixed(1)),
    weekendShiftBalance: Number(weekendBalance.toFixed(1)),
  };
}

function checkViolations(shifts: GeneratedShift[], staff: StaffRow[], rules: ShiftRule[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const staffMap = new Map(staff.map((s) => [s.id, s.full_name ?? s.id]));

  const activeRules = rules.filter((r) => r.is_active);

  for (const rule of activeRules) {
    switch (rule.rule_type) {
      case "max_nights_per_month": {
        const counts = new Map<string, Map<string, number>>();
        for (const shift of shifts) {
          if (shift.period !== "night") continue;
          const month = shift.shift_date.slice(0, 7);
          const staffCounts = counts.get(shift.staff_id) ?? new Map();
          staffCounts.set(month, (staffCounts.get(month) ?? 0) + 1);
          counts.set(shift.staff_id, staffCounts);
        }
        for (const [staffId, monthCounts] of counts) {
          for (const [month, count] of monthCounts) {
            if (count > rule.value) {
              violations.push({
                staff_id: staffId,
                staff_name: staffMap.get(staffId),
                rule: rule.name,
                message: `${count} night shifts in ${month} (max ${rule.value})`,
                severity: "warning",
              });
            }
          }
        }
        break;
      }
      case "max_consecutive_days": {
        for (const s of staff) {
          const dates = [...new Set(shifts.filter((sh) => sh.staff_id === s.id).map((sh) => sh.shift_date))].sort();
          let streak = 1;
          let maxStreak = 0;
          for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]);
            const curr = new Date(dates[i]);
            prev.setDate(prev.getDate() + 1);
            if (format(prev, "yyyy-MM-dd") === format(curr, "yyyy-MM-dd")) {
              streak++;
            } else {
              maxStreak = Math.max(maxStreak, streak);
              streak = 1;
            }
          }
          maxStreak = Math.max(maxStreak, streak);
          if (maxStreak > rule.value) {
            violations.push({
              staff_id: s.id,
              staff_name: staffMap.get(s.id),
              rule: rule.name,
              message: `${maxStreak} consecutive working days (max ${rule.value})`,
              severity: "warning",
            });
          }
        }
        break;
      }
      case "min_rest_hours": {
        const byStaff = new Map<string, GeneratedShift[]>();
        for (const shift of shifts) byStaff.set(shift.staff_id, [...(byStaff.get(shift.staff_id) ?? []), shift]);
        for (const [staffId, staffShifts] of byStaff) {
          const sorted = staffShifts.sort((a, b) => `${a.shift_date} ${a.period}`.localeCompare(`${b.shift_date} ${b.period}`));
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            const prevEnd = prev.period === "morning" ? 15 : prev.period === "afternoon" ? 23 : 7; // night ends next day 7am
            const prevDateEnd = new Date(prev.shift_date);
            if (prev.period === "night") prevDateEnd.setDate(prevDateEnd.getDate() + 1);
            prevDateEnd.setHours(prevEnd, 0, 0, 0);
            const currStart = new Date(curr.shift_date);
            currStart.setHours(curr.period === "morning" ? 7 : curr.period === "afternoon" ? 15 : 23, 0, 0, 0);
            const diffHours = (currStart.getTime() - prevDateEnd.getTime()) / (1000 * 60 * 60);
            if (diffHours < rule.value && diffHours >= 0) {
              violations.push({
                staff_id: staffId,
                staff_name: staffMap.get(staffId),
                rule: rule.name,
                message: `Only ${Math.round(diffHours)} hours rest between ${prev.shift_date} ${prev.period} and ${curr.shift_date} ${curr.period} (min ${rule.value})`,
                severity: "critical",
              });
            }
          }
        }
        break;
      }
      case "max_weekends_per_month": {
        const counts = new Map<string, Map<string, number>>();
        for (const shift of shifts) {
          const day = new Date(shift.shift_date).getDay();
          if (day !== 0 && day !== 6) continue;
          const month = shift.shift_date.slice(0, 7);
          const staffCounts = counts.get(shift.staff_id) ?? new Map();
          staffCounts.set(month, (staffCounts.get(month) ?? 0) + 1);
          counts.set(shift.staff_id, staffCounts);
        }
        for (const [staffId, monthCounts] of counts) {
          for (const [month, count] of monthCounts) {
            if (count > rule.value) {
              violations.push({
                staff_id: staffId,
                staff_name: staffMap.get(staffId),
                rule: rule.name,
                message: `${count} weekend shifts in ${month} (max ${rule.value})`,
                severity: "warning",
              });
            }
          }
        }
        break;
      }
      case "max_hours_per_week": {
        const counts = new Map<string, Map<string, number>>();
        for (const shift of shifts) {
          const week = getWeekStart(shift.shift_date);
          const staffCounts = counts.get(shift.staff_id) ?? new Map();
          staffCounts.set(week, (staffCounts.get(week) ?? 0) + PERIOD_HOURS[shift.period]);
          counts.set(shift.staff_id, staffCounts);
        }
        for (const [staffId, weekCounts] of counts) {
          for (const [week, hours] of weekCounts) {
            if (hours > rule.value) {
              violations.push({
                staff_id: staffId,
                staff_name: staffMap.get(staffId),
                rule: rule.name,
                message: `${hours} hours in week of ${week} (max ${rule.value})`,
                severity: "warning",
              });
            }
          }
        }
        break;
      }
    }
  }

  return violations;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  return format(d, "yyyy-MM-dd");
}
