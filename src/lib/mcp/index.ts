import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyShifts from "./tools/list-my-shifts";
import listMyAppointments from "./tools/list-my-appointments";
import listMyRequests from "./tools/list-my-requests";
import submitLeaveRequest from "./tools/submit-leave-request";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "dutyflow-health",
  title: "DutyFlow Health",
  version: "0.1.0",
  instructions:
    "Tools for DutyFlow Health, a hospital duty roster and appointment system. Use them to read the signed-in user's shifts, appointments, and requests, and to submit leave requests. All data is scoped to the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyShifts, listMyAppointments, listMyRequests, submitLeaveRequest],
});
