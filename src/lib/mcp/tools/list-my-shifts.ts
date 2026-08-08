import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_shifts",
  title: "List my shifts",
  description: "List the signed-in staff member's rostered shifts within a date range.",
  inputSchema: {
    start_date: z.string().describe("Start date (YYYY-MM-DD), inclusive."),
    end_date: z.string().describe("End date (YYYY-MM-DD), inclusive."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("shifts")
      .select("id, shift_date, period, type, notes")
      .eq("staff_id", ctx.getUserId()!)
      .gte("shift_date", start_date)
      .lte("shift_date", end_date)
      .order("shift_date");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { shifts: data ?? [] },
    };
  },
});
