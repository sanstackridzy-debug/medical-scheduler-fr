import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { addMonths, format, parseISO, differenceInCalendarDays } from "date-fns";
import { Repeat, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SHIFT_PERIODS, SHIFT_TYPES, shiftPeriodLabel, shiftTypeLabel, type ShiftPeriod, type ShiftType } from "@/lib/shift-utils";
import { useServerFn } from "@tanstack/react-start";
import { generateSmartSchedule } from "@/lib/scheduling.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

const WEEKDAYS = [
  { idx: 1, label: "Mon" },
  { idx: 2, label: "Tue" },
  { idx: 3, label: "Wed" },
  { idx: 4, label: "Thu" },
  { idx: 5, label: "Fri" },
  { idx: 6, label: "Sat" },
  { idx: 0, label: "Sun" },
];

interface Props {
  defaultStart: Date;
  defaultEnd: Date;
  staff: { id: string; full_name?: string; role: string }[];
  currentUserId: string;
  onDone: () => void;
}

export function AutoScheduleDialog({ defaultStart, defaultEnd, staff, currentUserId, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(format(defaultStart, "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(defaultEnd, "yyyy-MM-dd"));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [periods, setPeriods] = useState<ShiftPeriod[]>(["morning", "afternoon"]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(["ward_duty"]);
  const [pool, setPool] = useState<string[]>([]);
  const [perShift, setPerShift] = useState(1);
  const [roleFilter, setRoleFilter] = useState<"all" | "doctor" | "nurse">("all");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateSmartSchedule>> | null>(null);
  const generateFn = useServerFn(generateSmartSchedule);

  const eligible = staff.filter((s) => roleFilter === "all" || s.role === roleFilter);
  const selected = pool.filter((id) => eligible.some((s) => s.id === id));

  function toggle<T>(list: T[], v: T, set: (l: T[]) => void) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function generate() {
    const s = parseISO(start);
    const e = parseISO(end);
    if (differenceInCalendarDays(e, s) < 0) return toast.error("End date must be after start date");
    if (differenceInCalendarDays(e, s) > 180) return toast.error("Range is limited to 180 days");
    if (periods.length === 0) return toast.error("Pick at least one period");
    if (shiftTypes.length === 0) return toast.error("Pick at least one shift type");
    if (weekdays.length === 0) return toast.error("Pick at least one weekday");
    if (selected.length === 0) return toast.error("Pick at least one staff member for the rotation");
    if (perShift > selected.length) return toast.error("Staff per shift exceeds the rotation pool");

    setGenerating(true);
    try {
      const res = await generateFn({
        data: {
          start,
          end,
          periods,
          shiftTypes,
          weekdays,
          staffIds: selected,
          perShift,
        },
      });
      setResult(res);
      if (res.shifts.length === 0) toast.info("No shifts could be generated");
    } catch (err: any) {
      toast.error(err.message ?? "Could not generate schedule");
    } finally {
      setGenerating(false);
    }
  }

  async function apply() {
    if (!result || result.shifts.length === 0) return;
    const rows = result.shifts.map((s) => ({
      staff_id: s.staff_id,
      shift_date: s.shift_date,
      period: s.period,
      type: s.type,
      created_by: currentUserId,
      notes: "Auto-generated",
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("shifts").insert(rows.slice(i, i + 200));
      if (error) throw error;
    }

    toast.success(`Created ${rows.length} shift${rows.length === 1 ? "" : "s"}`);
    setOpen(false);
    setResult(null);
    setPool([]);
    onDone();
  }

  function cancel() {
    setOpen(false);
    setResult(null);
    setPool([]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Repeat className="mr-1 h-4 w-4" /> Smart schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Smart auto-scheduler</DialogTitle>
          <DialogDescription>
            Generate a fair schedule that respects availability, skills, and fatigue rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Repeat on</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {WEEKDAYS.map((w) => (
                <Button
                  key={w.idx}
                  type="button"
                  size="sm"
                  variant={weekdays.includes(w.idx) ? "default" : "outline"}
                  onClick={() => toggle(weekdays, w.idx, setWeekdays)}
                >
                  {w.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Periods</Label>
              <div className="mt-1 space-y-1">
                {SHIFT_PERIODS.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={periods.includes(p)} onCheckedChange={() => toggle(periods, p, setPeriods)} />
                    {shiftPeriodLabel[p]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Shift types</Label>
              <div className="mt-1 space-y-1">
                {SHIFT_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={shiftTypes.includes(t)} onCheckedChange={() => toggle(shiftTypes, t, setShiftTypes)} />
                    {shiftTypeLabel[t]}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Staff per shift</Label>
              <Input type="number" min={1} max={10} value={perShift} onChange={(e) => setPerShift(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div>
              <Label>Role filter</Label>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  <SelectItem value="doctor">Doctors</SelectItem>
                  <SelectItem value="nurse">Nurses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Rotation pool</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setPool(eligible.map((s) => s.id))}>All</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPool([])}>None</Button>
              </div>
            </div>
            <div className="mt-1 max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
              {eligible.length === 0 && <div className="text-sm text-muted-foreground">No staff available.</div>}
              {eligible.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={pool.includes(s.id)} onCheckedChange={() => toggle(pool, s.id, setPool)} />
                  <span className="flex-1 truncate">{s.full_name}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize">{s.role}</Badge>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{selected.length} selected</p>
          </div>

          {!result && (
            <Button onClick={generate} disabled={generating} className="w-full">
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : "Generate schedule"}
            </Button>
          )}

          {result && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Generated shifts</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{result.shifts.length}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Fairness score</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Math.round(100 - result.fairness.stdDeviation * 10)}</div>
                    <Progress value={Math.max(0, Math.min(100, 100 - result.fairness.stdDeviation * 10))} className="mt-2 h-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Night balance</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{result.fairness.nightShiftBalance}%</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Weekend balance</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold">{result.fairness.weekendShiftBalance}%</div></CardContent>
                </Card>
              </div>

              {result.violations.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{result.violations.length} rule violation{result.violations.length === 1 ? "" : "s"}</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="max-h-32">
                      <ul className="space-y-1 text-xs">
                        {result.violations.slice(0, 10).map((v, i) => (
                          <li key={i}>{v.staff_name}: {v.message}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {result.uncovered.length > 0 && (
                <Alert variant="default">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{result.uncovered.length} uncovered slot{result.uncovered.length === 1 ? "" : "s"}</AlertTitle>
                  <AlertDescription>
                    <ScrollArea className="max-h-32">
                      <ul className="space-y-1 text-xs">
                        {result.uncovered.slice(0, 10).map((u, i) => (
                          <li key={i}>{u.shift_date} · {u.period} · {shiftTypeLabel[u.type]} — {u.reason}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {result.violations.length === 0 && result.uncovered.length === 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Schedule looks good</AlertTitle>
                  <AlertDescription>No rule violations or uncovered slots detected.</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cancel}>Cancel</Button>
          {result ? (
            <Button onClick={apply} disabled={result.shifts.length === 0}>Apply {result.shifts.length} shifts</Button>
          ) : (
            <Button onClick={generate} disabled={generating}>
              {generating ? "Generating…" : "Generate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
