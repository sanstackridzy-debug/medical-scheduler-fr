import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "submit_leave_request",
  title: "Submit leave request",
  description:
    "Submit a leave request for the signed-in staff member. It is created as pending and must be approved by an admin.",
  inputSchema: {
    leave_start: z.string().describe("First day of leave (YYYY-MM-DD)."),
    leave_end: z.string().describe("Last day of leave (YYYY-MM-DD)."),
    reason: z.string().optional().describe("Optional reason for the leave."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ leave_start, leave_end, reason }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (leave_end < leave_start) {
      return { content: [{ type: "text", text: "leave_end must not be before leave_start" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("requests")
      .insert({
        staff_id: ctx.getUserId()!,
        request_type: "leave",
        leave_start,
        leave_end,
        reason: reason ?? null,
      })
      .select("id, request_type, status, leave_start, leave_end, reason")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { request: data },
    };
  },
});
