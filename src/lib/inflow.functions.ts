import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateForecast, predictInflow, type InflowRow } from "./forecasting";

export const getForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("patient_inflow")
      .select("*")
      .order("inflow_date", { ascending: false })
      .limit(90);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as InflowRow[];

    const today = new Date().toISOString().slice(0, 10);
    const forecast = generateForecast(rows, today, 7);
    return { forecast, history: rows };
  });

export const recordActualInflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ date: z.string(), actualCount: z.number().int().min(0), notes: z.string().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can record inflow data");

    const { error } = await context.supabase
      .from("patient_inflow")
      .upsert(
        {
          inflow_date: data.date,
          actual_count: data.actualCount,
          source: "historical",
          notes: data.notes ?? null,
        },
        { onConflict: "inflow_date" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can refresh forecasts");

    const { data, error } = await context.supabase
      .from("patient_inflow")
      .select("*")
      .order("inflow_date", { ascending: false })
      .limit(180);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as InflowRow[];

    const today = new Date().toISOString().slice(0, 10);
    const forecast = generateForecast(rows, today, 14);
    const predictions = forecast
      .filter((f) => f.source === "forecast" || (f.source === "historical" && f.actual_count === null))
      .map((f) => ({
        inflow_date: f.inflow_date,
        actual_count: f.actual_count,
        predicted_count: f.predicted_count,
        source: "forecast",
        notes: f.notes,
      }));

    if (predictions.length > 0) {
      const { error: upsertError } = await context.supabase.from("patient_inflow").upsert(predictions, {
        onConflict: "inflow_date",
      });
      if (upsertError) throw new Error(upsertError.message);
    }

    return { updated: predictions.length };
  });
