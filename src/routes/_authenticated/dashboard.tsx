import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { shiftTypeLabel, shiftPeriodShort, isDoctorOnDuty, type ShiftPeriod, type ShiftType } from "@/lib/shift-utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Users, Calendar as CalIcon, ClipboardList, Clock, CalendarClock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MediRoster" },
      { name: "description", content: "Your hospital duty and appointment dashboard." },
      { property: "og:title", content: "MediRoster Dashboard" },
      { property: "og:description", content: "Duty roster, appointments, and staff requests." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;

  if (profile?.status === "pending") {
    return (
      <AppShell profile={profile} role={null}>
        <Card>
          <CardHeader><CardTitle>Awaiting approval</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Your <span className="font-medium capitalize">{profile.requested_role}</span> account is pending admin approval.</p>
            <p>You'll be notified once an administrator reviews your request.</p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (profile?.status === "rejected") {
    return (
      <AppShell profile={profile} role={null}>
        <Card>
          <CardHeader><CardTitle>Account not approved</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your staff account request was not approved. Please contact your administrator for more information.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell profile={profile} role={primaryRole}>
      {primaryRole === "admin" && <AdminDashboard />}
      {(primaryRole === "doctor" || primaryRole === "nurse") && <StaffDashboard userId={user.id} role={primaryRole} />}
      {primaryRole === "patient" && <PatientDashboard userId={user.id} />}
      {!primaryRole && (
        <Card><CardContent className="p-6 text-muted-foreground">No role assigned. Contact an administrator.</CardContent></Card>
      )}
    </AppShell>
  );
}


function StatCard({ title, value, icon, hint }: { title: string; value: string | number; icon: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const nowHour = new Date().getHours();
  const currentPeriod: ShiftPeriod = nowHour < 15 ? "morning" : nowHour < 23 ? "afternoon" : "night";

  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [onDutyNow, setOnDutyNow] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [staffCount, setStaffCount] = useState(0);

  useEffect(() => {
    supabase
      .from("shifts")
      .select("*, profiles:staff_id(full_name, email)")
      .eq("shift_date", today)
      .order("period")
      .then(({ data }) => {
        setTodayShifts(data ?? []);
        setOnDutyNow((data ?? []).filter((s: any) => s.period === currentPeriod));
      });
    supabase
      .from("requests")
      .select("*, profiles:staff_id(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPendingRequests(data ?? []));
    supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .in("role", ["doctor", "nurse"])
      .then(({ count }) => setStaffCount(count ?? 0));
  }, [today, currentPeriod]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's Duties" value={todayShifts.length} icon={<CalIcon className="h-4 w-4" />} hint={`across all shifts`} />
        <StatCard title="Staff on Duty Now" value={onDutyNow.length} icon={<Clock className="h-4 w-4" />} hint={`${currentPeriod} shift`} />
        <StatCard title="Pending Requests" value={pendingRequests.length} icon={<ClipboardList className="h-4 w-4" />} hint="need review" />
        <StatCard title="Total Staff" value={staffCount} icon={<Users className="h-4 w-4" />} hint="doctors + nurses" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Staff on duty now</CardTitle>
            <CardDescription>Currently assigned to the {currentPeriod} shift</CardDescription>
          </CardHeader>
          <CardContent>
            {onDutyNow.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one is on duty right now.</p>
            ) : (
              <ul className="space-y-2">
                {onDutyNow.map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">{s.profiles?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s.profiles?.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary">On-call</Badge>
                      <Badge variant="outline">{shiftTypeLabel[s.type as ShiftType]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending swap / leave requests</CardTitle>
              <CardDescription>{pendingRequests.length} awaiting approval</CardDescription>
            </div>
            <Button size="sm" variant="outline" asChild><Link to="/requests">Review</Link></Button>
          </CardHeader>
          <CardContent>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <ul className="space-y-2">
                {pendingRequests.slice(0, 5).map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">{r.profiles?.full_name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{r.request_type} — {r.reason ?? "no reason"}</div>
                    </div>
                    <Badge variant="secondary">pending</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's roster</CardTitle>
          <CardDescription>All shifts scheduled for today</CardDescription>
        </CardHeader>
        <CardContent>
          {todayShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts scheduled today. <Link to="/roster" className="text-primary underline">Open roster →</Link></p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {(["morning", "afternoon", "night"] as ShiftPeriod[]).map((p) => (
                <div key={p} className="rounded-md border p-3">
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{shiftPeriodShort[p]}</div>
                  <ul className="space-y-1 text-sm">
                    {todayShifts.filter((s) => s.period === p).map((s: any) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{shiftTypeLabel[s.type as ShiftType]}</Badge>
                        <span>{s.profiles?.full_name}</span>
                      </li>
                    )) || <li className="text-muted-foreground">—</li>}
                    {todayShifts.filter((s) => s.period === p).length === 0 && <li className="text-xs text-muted-foreground">Unassigned</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StaffDashboard({ userId, role }: { userId: string; role: "doctor" | "nurse" }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [onDutyNow, setOnDutyNow] = useState(false);

  useEffect(() => {
    supabase
      .from("shifts")
      .select("*")
      .eq("staff_id", userId)
      .gte("shift_date", today)
      .order("shift_date")
      .limit(10)
      .then(({ data }) => {
        setUpcoming(data ?? []);
        setOnDutyNow(isDoctorOnDuty(data ?? [], today, format(new Date(), "HH:mm")));
      });
    if (role === "doctor") {
      supabase
        .from("appointments")
        .select("*, profiles:patient_id(full_name)")
        .eq("doctor_id", userId)
        .gte("appt_date", today)
        .eq("status", "booked")
        .order("appt_date")
        .limit(10)
        .then(({ data }) => setAppts(data ?? []));
    }
  }, [userId, today, role]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold capitalize">{role} Dashboard</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        {onDutyNow && <Badge className="bg-[--shift-oncall] text-white">On-call now</Badge>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My upcoming duties</CardTitle>
            <CardDescription>Next {upcoming.length} shifts</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming duties.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div>
                      <div className="font-medium">{format(new Date(s.shift_date), "EEE, MMM d")}</div>
                      <div className="text-xs text-muted-foreground capitalize">{s.period}</div>
                    </div>
                    <Badge variant="outline">{shiftTypeLabel[s.type as ShiftType]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {role === "doctor" && (
          <Card>
            <CardHeader>
              <CardTitle>My appointments</CardTitle>
              <CardDescription>Upcoming patient bookings</CardDescription>
            </CardHeader>
            <CardContent>
              {appts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
              ) : (
                <ul className="space-y-2">
                  {appts.map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div>
                        <div className="font-medium">{a.profiles?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(a.appt_date), "MMM d")} · {a.start_time.slice(0,5)}</div>
                      </div>
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PatientDashboard({ userId }: { userId: string }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [appts, setAppts] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("appointments")
      .select("*, doctor:doctor_id(full_name, specialty_id, specialties:specialty_id(name))")
      .eq("patient_id", userId)
      .gte("appt_date", today)
      .eq("status", "booked")
      .order("appt_date")
      .then(({ data }) => setAppts(data ?? []));
  }, [userId, today]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming appointments</CardTitle>
            <CardDescription>{appts.length} booked</CardDescription>
          </CardHeader>
          <CardContent>
            {appts.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No appointments yet.</p>
                <Button asChild size="sm"><Link to="/book">Book an appointment</Link></Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {appts.map((a: any) => (
                  <li key={a.id} className="rounded-md border p-3 text-sm">
                    <div className="font-medium">{a.doctor?.full_name}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(a.appt_date), "EEE, MMM d")} at {a.start_time.slice(0,5)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild><Link to="/book">Book new appointment</Link></Button>
            <Button asChild variant="outline"><Link to="/appointments">View history</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
