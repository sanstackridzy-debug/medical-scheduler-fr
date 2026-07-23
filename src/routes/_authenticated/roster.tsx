import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addMonths, endOfMonth, format, isSameDay, startOfMonth, startOfWeek, addDays, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Download } from "lucide-react";
import { SHIFT_PERIODS, SHIFT_TYPES, shiftPeriodLabel, shiftPeriodShort, shiftTypeClass, shiftTypeLabel, type ShiftPeriod, type ShiftType } from "@/lib/shift-utils";
import { toast } from "sonner";
import { downloadCSV, downloadPDF } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/roster")({
  head: () => ({
    meta: [
      { title: "Duty Roster — MediRoster" },
      { name: "description", content: "Monthly staff duty roster with morning, afternoon, and night shifts." },
      { property: "og:title", content: "Duty Roster" },
      { property: "og:description", content: "Assign and view hospital staff shifts on a monthly calendar." },
    ],
  }),
  component: RosterPage,
});

interface Shift {
  id: string;
  staff_id: string;
  shift_date: string;
  period: ShiftPeriod;
  type: ShiftType;
  notes: string | null;
  profiles?: { full_name: string; email: string } | null;
}

function RosterPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [month, setMonth] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const isAdmin = primaryRole === "admin";
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });

  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  async function loadShifts() {
    const { data } = await supabase
      .from("shifts")
      .select("*, profiles:staff_id(full_name, email)")
      .gte("shift_date", format(monthStart, "yyyy-MM-dd"))
      .lte("shift_date", format(monthEnd, "yyyy-MM-dd"))
      .order("shift_date");
    setShifts((data ?? []) as unknown as Shift[]);
  }

  async function loadStaff() {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id, role, profiles:user_id(id, full_name, email)")
      .in("role", ["doctor", "nurse"]);
    setStaff((data ?? []).map((r: any) => ({ id: r.user_id, role: r.role, ...r.profiles })));
  }

  useEffect(() => {
    if (!user) return;
    loadShifts();
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, month]);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;

  function shiftsForDay(d: Date) {
    return shifts.filter((s) => s.shift_date === format(d, "yyyy-MM-dd"));
  }

  function exportCSV() {
    const rows = shifts.map((s) => ({
      Date: s.shift_date,
      Period: s.period,
      Type: shiftTypeLabel[s.type],
      Staff: s.profiles?.full_name ?? "",
      Email: s.profiles?.email ?? "",
      Notes: s.notes ?? "",
    }));
    downloadCSV(`roster-${format(month, "yyyy-MM")}.csv`, rows);
  }
  function exportPDF() {
    downloadPDF(
      `roster-${format(month, "yyyy-MM")}.pdf`,
      `Duty Roster — ${format(month, "MMMM yyyy")}`,
      ["Date", "Period", "Type", "Staff"],
      shifts.map((s) => [s.shift_date, s.period, shiftTypeLabel[s.type], s.profiles?.full_name ?? ""]),
    );
  }

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <h1 className="min-w-40 text-center text-xl font-bold">{format(month, "MMMM yyyy")}</h1>
            <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>Today</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={exportPDF}><Download className="mr-1 h-4 w-4" /> PDF</Button>
          </div>
        </div>

        <ShiftLegend />

        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-secondary text-center text-xs font-semibold uppercase text-muted-foreground">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = isSameMonth(d, month);
              const today = isSameDay(d, new Date());
              const dayShifts = shiftsForDay(d);
              return (
                <button
                  key={d.toString()}
                  onClick={() => setSelectedDate(d)}
                  className={`min-h-24 border-b border-r p-1.5 text-left transition-colors hover:bg-accent ${inMonth ? "bg-card" : "bg-secondary/40 text-muted-foreground"}`}
                >
                  <div className={`mb-1 flex items-center justify-between text-xs font-semibold ${today ? "text-primary" : ""}`}>
                    <span className={today ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}>{format(d, "d")}</span>
                    {dayShifts.length > 0 && <span className="text-[10px] text-muted-foreground">{dayShifts.length}</span>}
                  </div>
                  <div className="space-y-0.5">
                    {dayShifts.slice(0, 3).map((s) => (
                      <div key={s.id} className={`truncate rounded px-1 text-[10px] font-medium ${shiftTypeClass[s.type]}`}>
                        {shiftPeriodShort[s.period]} · {s.profiles?.full_name?.split(" ")[0]}
                      </div>
                    ))}
                    {dayShifts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayShifts.length - 3} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {selectedDate && (
          <DayDetail
            date={selectedDate}
            shifts={shiftsForDay(selectedDate)}
            staff={staff}
            isAdmin={isAdmin}
            currentUserId={user.id}
            onClose={() => setSelectedDate(null)}
            onChanged={loadShifts}
          />
        )}
      </div>
    </AppShell>
  );
}

function ShiftLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {SHIFT_TYPES.map((t) => (
        <div key={t} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded ${shiftTypeClass[t]}`} />
          <span>{shiftTypeLabel[t]}</span>
        </div>
      ))}
    </div>
  );
}

function DayDetail({ date, shifts, staff, isAdmin, currentUserId, onClose, onChanged }: {
  date: Date; shifts: Shift[]; staff: any[]; isAdmin: boolean; currentUserId: string; onClose: () => void; onChanged: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{format(date, "EEEE, MMMM d, yyyy")}</CardTitle>
        <div className="flex gap-2">
          {isAdmin && <AssignShiftDialog date={date} staff={staff} currentUserId={currentUserId} onDone={onChanged} />}
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {SHIFT_PERIODS.map((p) => {
          const list = shifts.filter((s) => s.period === p);
          return (
            <div key={p}>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{shiftPeriodLabel[p]}</div>
              {list.length === 0 ? <div className="text-sm text-muted-foreground">— unassigned —</div> : (
                <ul className="space-y-1">
                  {list.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge className={shiftTypeClass[s.type]}>{shiftTypeLabel[s.type]}</Badge>
                        <span className="font-medium">{s.profiles?.full_name}</span>
                        {s.notes && <span className="text-xs text-muted-foreground">— {s.notes}</span>}
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={async () => {
                          await supabase.from("shifts").delete().eq("id", s.id);
                          toast.success("Shift removed");
                          onChanged();
                        }}>Remove</Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AssignShiftDialog({ date, staff, currentUserId, onDone }: { date: Date; staff: any[]; currentUserId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("");
  const [period, setPeriod] = useState<ShiftPeriod>("morning");
  const [type, setType] = useState<ShiftType>("ward_duty");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!staffId) return toast.error("Pick a staff member");
    setSaving(true);
    const { error } = await supabase.from("shifts").insert({
      staff_id: staffId,
      shift_date: format(date, "yyyy-MM-dd"),
      period,
      type,
      notes: notes || null,
      created_by: currentUserId,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") toast.error("This staff member is already booked for that shift.");
      else toast.error(error.message);
      return;
    }
    toast.success("Shift assigned");
    setOpen(false);
    setStaffId(""); setNotes("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Assign shift</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign shift — {format(date, "MMM d, yyyy")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Staff member</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as ShiftPeriod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHIFT_PERIODS.map((p) => <SelectItem key={p} value={p}>{shiftPeriodLabel[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ShiftType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((t) => <SelectItem key={t} value={t}>{shiftTypeLabel[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
