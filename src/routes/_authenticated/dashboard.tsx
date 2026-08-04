import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile, type Profile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { shiftTypeLabel, shiftPeriodShort, periodHours, type ShiftPeriod, type ShiftType } from "@/lib/shift-utils";
import { calculateFairness } from "@/lib/scheduling";
import { recommendedStaffing, type InflowRow } from "@/lib/forecasting";
import { getForecast } from "@/lib/inflow.functions";
import { useAvatarUrl, initialsOf } from "@/lib/avatar";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Users, Calendar as CalIcon, ClipboardList, Clock, CalendarClock, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";


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
  const welcomedRef = useRef(false);

  useEffect(() => {
    if (welcomedRef.current) return;
    if (!profile || pLoading) return;
    welcomedRef.current = true;
    toast.success(`Welcome back${profile.full_name ? ", " + profile.full_name : ""}`, {
      description: "You're signed in to MediRoster.",
    });
  }, [profile, pLoading]);

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
      {(primaryRole === "doctor" || primaryRole === "nurse") && (
        <StaffDashboard userId={user.id} role={primaryRole} profile={profile} />
      )}
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

function TileStat({
  title,
  value,
  hint,
  icon,
  tone,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "amber" | "violet";
}) {
  const tones: Record<string, string> = {
    blue: "bg-sky-50 dark:bg-sky-950/30 text-sky-600",
    green: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600",
    amber: "bg-amber-50 dark:bg-amber-950/30 text-amber-600",
    violet: "bg-violet-50 dark:bg-violet-950/30 text-violet-600",
  };
  const [bg, fg] = [tones[tone].split(" text-")[0], "text-" + tones[tone].split(" text-")[1]];
  return (
    <Card className={`overflow-hidden border-0 ${bg}`}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70 ${fg}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{title}</div>
          <div className="text-3xl font-bold leading-tight">{value}</div>
          {hint && <div className={`text-xs ${fg}`}>{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const nowHour = now.getHours();
  const greeting = nowHour < 12 ? "Good Morning" : nowHour < 17 ? "Good Afternoon" : "Good Evening";
  const currentPeriod: ShiftPeriod = nowHour < 15 ? "morning" : nowHour < 23 ? "afternoon" : "night";

  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [onDutyNow, setOnDutyNow] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [pendingAccounts, setPendingAccounts] = useState<any[]>([]);
  const [weekShifts, setWeekShifts] = useState<any[]>([]);
  const [monthShifts, setMonthShifts] = useState<any[]>([]);
  const [monthStaff, setMonthStaff] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [inflow, setInflow] = useState<InflowRow[]>([]);
  const fetchForecast = useServerFn(getForecast);



  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");


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
    supabase
      .from("profiles")
      .select("id, full_name, requested_role")
      .eq("status", "pending")
      .limit(5)
      .then(({ data }) => setPendingAccounts(data ?? []));
    supabase
      .from("shifts")
      .select("id, staff_id, period, shift_date")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd)
      .then(({ data }) => setWeekShifts(data ?? []));
    supabase
      .from("shifts")
      .select("id, staff_id, period, shift_date")
      .gte("shift_date", monthStart)
      .lte("shift_date", monthEnd)
      .then(({ data }) => setMonthShifts(data ?? []));
    supabase
      .from("user_roles")
      .select("user_id, role, profiles:user_id(id, full_name)")
      .in("role", ["doctor", "nurse"])
      .then(({ data }) => setMonthStaff((data ?? []).map((r: any) => ({ id: r.user_id, full_name: r.profiles?.full_name, role: r.role }))));

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(4)
        .then(({ data: n }) => setNotes(n ?? []));
    });
  }, [today, currentPeriod, weekStart, weekEnd, monthStart, monthEnd]);


  const nightShifts = weekShifts.filter((s: any) => s.period === "night").length;
  const coverage = staffCount > 0 ? Math.min(100, (todayShifts.length / staffCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Greeting + current period */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold">
            {greeting}, <span className="text-primary">Admin</span> 👋
          </h1>
          <p className="text-sm text-muted-foreground">{format(now, "EEEE, MMMM d, yyyy")}</p>
          <p className="mt-1 text-sm text-muted-foreground">Here's the hospital overview for today.</p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">Current Period</div>
              <div className="truncate font-semibold capitalize text-primary">{shiftPeriodShort[currentPeriod]} shift</div>
              <div className="text-xs text-muted-foreground">
                {periodHours(currentPeriod).start} – {periodHours(currentPeriod).end}
              </div>
            </div>
            <Badge className="bg-primary text-primary-foreground">Live</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TileStat tone="blue" title="Today's Duties" value={todayShifts.length} icon={<CalIcon className="h-5 w-5" />} hint="across all shifts" />
        <TileStat tone="green" title="Staff on Duty Now" value={onDutyNow.length} icon={<Users className="h-5 w-5" />} hint={`${currentPeriod} shift`} />
        <TileStat tone="amber" title="Pending Requests" value={pendingRequests.length} icon={<ClipboardList className="h-5 w-5" />} hint="leave / swap" />
        <TileStat tone="violet" title="Total Staff" value={staffCount} icon={<Clock className="h-5 w-5" />} hint="doctors + nurses" />
      </div>

      <FairnessWidget shifts={monthShifts} staff={monthStaff} />

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Notifications</CardTitle>
            <Button size="sm" variant="ghost" asChild><Link to="/notifications">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n: any) => (
                  <li key={n.id} className="rounded-md border p-2">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{fmt(n.created_at, "MMM d, HH:mm", "")}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Pending accounts</CardTitle>
              <CardDescription>{pendingAccounts.length} awaiting approval</CardDescription>
            </div>
            <Button size="sm" variant="ghost" asChild><Link to="/staff">Review</Link></Button>
          </CardHeader>
          <CardContent>
            {pendingAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending signups.</p>
            ) : (
              <ul className="space-y-2">
                {pendingAccounts.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="truncate font-medium">{p.full_name ?? "—"}</span>
                    <Badge variant="secondary" className="capitalize">{p.requested_role ?? "staff"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/roster">Open roster</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/staff">Manage staff</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/departments">Departments</Link></Button>
            <Button variant="outline" size="sm" asChild><Link to="/requests">Requests</Link></Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workload Overview</CardTitle>
          <CardDescription>This week ({fmt(weekStart, "MMM d")} – {fmt(weekEnd, "MMM d")})</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Shifts This Week" value={`${weekShifts.length}`} pct={Math.min(100, (weekShifts.length / 50) * 100)} />
          <Metric label="Night Shifts" value={`${nightShifts}`} pct={Math.min(100, (nightShifts / 15) * 100)} />
          <Metric label="Today's Coverage" value={`${todayShifts.length} / ${staffCount}`} pct={coverage} />
          <Metric label="Open Requests" value={`${pendingRequests.length}`} pct={Math.min(100, pendingRequests.length * 10)} />
        </CardContent>
      </Card>
    </div>

  );
}

function safeDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  return isNaN(d.getTime()) ? null : d;
}
function fmt(v: string | null | undefined, pattern: string, fallback = "—") {
  const d = safeDate(v);
  return d ? format(d, pattern) : fallback;
}
function hhmm(t?: string | null) {
  return t ? String(t).slice(0, 5) : "—";
}

function StaffDashboard({ userId, role, profile }: { userId: string; role: "doctor" | "nurse"; profile: Profile | null }) {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const nowHour = now.getHours();
  const currentPeriod: ShiftPeriod = nowHour >= 7 && nowHour < 15 ? "morning" : nowHour >= 15 && nowHour < 23 ? "afternoon" : "night";

  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [weekShifts, setWeekShifts] = useState<any[]>([]);
  const [pendingReq, setPendingReq] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const avatarUrl = useAvatarUrl(profile?.avatar_url);

  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  useEffect(() => {
    supabase
      .from("shifts")
      .select("*")
      .eq("staff_id", userId)
      .gte("shift_date", today)
      .order("shift_date")
      .limit(10)
      .then(({ data }) => setUpcoming(data ?? []));

    supabase
      .from("shifts")
      .select("*")
      .eq("staff_id", userId)
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd)
      .then(({ data }) => setWeekShifts(data ?? []));

    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("staff_id", userId)
      .eq("status", "pending")
      .then(({ count }) => setPendingReq(count ?? 0));

    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => setNotes(data ?? []));

    if (role === "doctor") {
      supabase
        .from("appointments")
        .select("*, profiles:patient_id(full_name)")
        .eq("doctor_id", userId)
        .gte("appt_date", today)
        .eq("status", "booked")
        .order("appt_date")
        .limit(10)
        .then(({ data }) => {
          const rows = data ?? [];
          setAppts(rows);
          setTodayAppts(rows.filter((a: any) => a.appt_date === today));
        });
    }
  }, [userId, today, role, weekStart, weekEnd]);

  useEffect(() => {
    if (!profile?.specialty_id) {
      setSpecialty(null);
      return;
    }
    supabase
      .from("specialties")
      .select("name")
      .eq("id", profile.specialty_id)
      .maybeSingle()
      .then(({ data }) => setSpecialty((data as any)?.name ?? null));
  }, [profile?.specialty_id]);

  const todayShifts = upcoming.filter((s) => s.shift_date === today);
  const currentShift = todayShifts.find((s) => s.period === currentPeriod) ?? null;
  const weeklyHours = weekShifts.length * 8;
  const nightShifts = weekShifts.filter((s) => s.period === "night").length;
  const greeting = nowHour < 12 ? "Good Morning" : nowHour < 17 ? "Good Afternoon" : "Good Evening";

  const timeline = [
    ...todayShifts.map((s) => {
      const h = periodHours(s.period as ShiftPeriod);
      return {
        key: `s-${s.id}`,
        time: h.start,
        title: `${shiftPeriodShort[s.period as ShiftPeriod]} shift — ${shiftTypeLabel[s.type as ShiftType]}`,
        sub: `${h.start} – ${h.end}`,
        icon: <CalIcon className="h-3.5 w-3.5" />,
      };
    }),
    ...todayAppts.map((a) => ({
      key: `a-${a.id}`,
      time: hhmm(a.start_time),
      title: "Appointment",
      sub: a.profiles?.full_name ?? "Patient",
      icon: <CalendarClock className="h-3.5 w-3.5" />,
    })),
  ].sort((x, y) => x.time.localeCompare(y.time));

  return (
    <div className="space-y-6">
      {/* Greeting + current shift */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold">
            {greeting}, <span className="text-primary">{profile?.full_name ?? "there"}</span> 👋
          </h1>
          <p className="text-sm text-muted-foreground">{format(now, "EEEE, MMMM d, yyyy")}</p>
          <p className="mt-1 text-sm text-muted-foreground">Here's your schedule and overview for today.</p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">Current Shift</div>
              {currentShift ? (
                <>
                  <div className="truncate font-semibold text-primary">
                    {shiftPeriodShort[currentShift.period as ShiftPeriod]} · {shiftTypeLabel[currentShift.type as ShiftType]}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {periodHours(currentShift.period as ShiftPeriod).start} – {periodHours(currentShift.period as ShiftPeriod).end}
                  </div>
                </>
              ) : (
                <div className="font-semibold text-muted-foreground">Off duty</div>
              )}
            </div>
            {currentShift && <Badge className="bg-[--shift-oncall] text-white">In progress</Badge>}
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's Shifts" value={todayShifts.length} icon={<CalIcon className="h-4 w-4" />} hint={currentShift ? shiftPeriodShort[currentShift.period as ShiftPeriod] + " shift" : "none active"} />
        <StatCard title="Upcoming Appointments" value={role === "doctor" ? appts.length : "—"} icon={<CalendarClock className="h-4 w-4" />} hint={role === "doctor" ? `${todayAppts.length} today` : "not applicable"} />
        <StatCard title="Pending Requests" value={pendingReq} icon={<ClipboardList className="h-4 w-4" />} hint="leave / swap" />
        <StatCard title="Hours This Week" value={`${weeklyHours} hrs`} icon={<Clock className="h-4 w-4" />} hint={`${weekShifts.length} duties scheduled`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming duties */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">My Upcoming Duties</CardTitle>
            <Button size="sm" variant="ghost" asChild><Link to="/roster">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming duties.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((s: any) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-md border-l-4 border-primary bg-secondary/40 p-2">
                    <div className="w-14 shrink-0 text-center">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{fmt(s.shift_date, "EEE")}</div>
                      <div className="text-xs font-bold">{fmt(s.shift_date, "MMM d")}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium capitalize">{s.period} shift</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {shiftTypeLabel[s.type as ShiftType]} · {periodHours(s.period as ShiftPeriod).start}–{periodHours(s.period as ShiftPeriod).end}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Today's Timeline</CardTitle>
            <CardDescription>{format(now, "MMMM d")}</CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
            ) : (
              <ol className="relative space-y-4 border-l pl-4">
                {timeline.map((t) => (
                  <li key={t.key} className="relative">
                    <span className="absolute -left-[22px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary" />
                    <div className="text-xs font-semibold text-muted-foreground">{t.time}</div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">{t.icon}{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.sub}</div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Profile + notifications + quick actions */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profile?.full_name ?? "Profile photo"} className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {initialsOf(profile?.full_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{profile?.full_name ?? "—"}</div>
                  <div className="truncate text-xs capitalize text-muted-foreground">{specialty ?? role}</div>
                </div>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Role</dt><dd className="font-medium capitalize">{role}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Department</dt><dd className="truncate font-medium">{specialty ?? "Unassigned"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Email</dt><dd className="truncate font-medium">{profile?.email ?? "—"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Phone</dt><dd className="font-medium">{profile?.phone ?? "—"}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Notifications</CardTitle>
              <Button size="sm" variant="ghost" asChild><Link to="/notifications">View all</Link></Button>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications.</p>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n: any) => (
                    <li key={n.id} className="rounded-md border p-2">
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{fmt(n.created_at, "MMM d, HH:mm", "")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" asChild><Link to="/requests">Request leave</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/requests">Swap shift</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/roster">View roster</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/profile">My profile</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appointments today + workload */}
      <div className="grid gap-4 lg:grid-cols-2">
        {role === "doctor" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">My Appointments</CardTitle>
                <CardDescription>Upcoming patient bookings</CardDescription>
              </div>
              <Button size="sm" variant="ghost" asChild><Link to="/appointments">View all</Link></Button>
            </CardHeader>
            <CardContent>
              {appts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
              ) : (
                <ul className="space-y-2">
                  {appts.map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div>
                        <div className="font-medium">{a.profiles?.full_name ?? "Patient"}</div>
                        <div className="text-xs text-muted-foreground">{fmt(a.appt_date, "MMM d")} · {hhmm(a.start_time)}</div>
                      </div>
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workload Overview</CardTitle>
            <CardDescription>This week ({fmt(weekStart, "MMM d")} – {fmt(weekEnd, "MMM d")})</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Weekly Hours" value={`${weeklyHours} / 50`} pct={Math.min(100, (weeklyHours / 50) * 100)} />
            <Metric label="Duties" value={`${weekShifts.length}`} pct={Math.min(100, (weekShifts.length / 7) * 100)} />
            <Metric label="Night Shifts" value={`${nightShifts}`} pct={Math.min(100, (nightShifts / 3) * 100)} />
            <Metric label="Appointments" value={`${role === "doctor" ? appts.length : 0}`} pct={Math.min(100, ((role === "doctor" ? appts.length : 0) / 25) * 100)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Number.isFinite(pct) ? pct : 0}%` }} />
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

function FairnessWidget({ shifts, staff }: { shifts: any[]; staff: any[] }) {
  const fairness = calculateFairness(
    shifts as any,
    staff,
  );
  const score = Math.max(0, Math.min(100, Math.round(100 - fairness.stdDeviation * 10)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart scheduling fairness</CardTitle>
        <CardDescription>Workload distribution for the current week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-4">
          <div className="text-4xl font-bold">{score}</div>
          <div className="text-sm text-muted-foreground">Fairness score</div>
        </div>
        {staff.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff data.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((s) => {
              const count = shifts.filter((x: any) => x.staff_id === s.id).length;
              const pct = fairness.averageShiftsPerStaff > 0 ? Math.round((count / fairness.averageShiftsPerStaff) * 100) : 0;
              return (
                <div key={s.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{s.full_name}</span>
                    <span className="text-muted-foreground">{count} shifts</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


