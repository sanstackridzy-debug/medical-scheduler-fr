import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ShiftPeriod, ShiftType } from "./shift-utils";
import { buildSchedule } from "./scheduling";

export const generateSmartSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      start: string;
      end: string;
      periods: ShiftPeriod[];
      shiftTypes: ShiftType[];
      weekdays: number[];
      staffIds: string[];
      perShift: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can generate schedules");

    if (data.staffIds.length === 0) throw new Error("Select at least one staff member");

    const { data: staffRows } = await supabase
      .from("user_roles")
      .select("role, user_id, profiles:user_id(id, full_name)")
      .in("user_id", data.staffIds);

    const staff = (staffRows ?? []).map((r: any) => ({ id: r.user_id, full_name: r.profiles?.full_name, role: r.role }));

    const [{ data: staffSkills }, { data: skillRequirements }, { data: availability }, { data: existingShifts }, { data: rules }] = await Promise.all([
      supabase.from("staff_skills").select("user_id, skill_id, expires_at").in("user_id", data.staffIds),
      supabase.from("shift_skill_requirements").select("shift_type, skill_id, required_count"),
      supabase
        .from("availability")
        .select("user_id, availability_date, status")
        .in("user_id", data.staffIds)
        .gte("availability_date", data.start)
        .lte("availability_date", data.end),
      supabase
        .from("shifts")
        .select("staff_id, shift_date, period")
        .gte("shift_date", data.start)
        .lte("shift_date", data.end),
      supabase.from("shift_rules").select("name, rule_type, value, is_active"),
    ]);

    return buildSchedule(
      data.start,
      data.end,
      data.periods,
      data.shiftTypes,
      data.weekdays,
      staff,
      (staffSkills ?? []) as any,
      (skillRequirements ?? []) as any,
      (availability ?? []) as any,
      (existingShifts ?? []) as any,
      (rules ?? []) as any,
      data.perShift,
    );
  });
