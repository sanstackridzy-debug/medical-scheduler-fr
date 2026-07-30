import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { addDays, format, parseISO, differenceInCalendarDays } from "date-fns";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { SHIFT_PERIODS, SHIFT_TYPES, shiftPeriodLabel, shiftTypeLabel, type ShiftPeriod, type ShiftType } from "@/lib/shift-utils";

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
  const [type, setType] = useState<ShiftType>("ward_duty");
  const [pool, setPool] = useState<string[]>([]);
  const [perShift, setPerShift] = useState(1);
  const [roleFilter, setRoleFilter] = useState<"all" | "doctor" | "nurse">("all");
  const [saving, setSaving] = useState(false);

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
    if (weekdays.length === 0) return toast.error("Pick at least one weekday");
    if (selected.length === 0) return toast.error("Pick at least one staff member for the rotation");
    if (perShift > selected.length) return toast.error("Staff per shift exceeds the rotation pool");

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("shifts")
        .select("staff_id, shift_date, period")
        .gte("shift_date", start)
        .lte("shift_date", end);
      const taken = new Set((existing ?? []).map((r: any) => `${r.staff_id}|${r.shift_date}|${r.period}`));

      const rows: any[] = [];
      let cursor = 0;
      for (let d = s; differenceInCalendarDays(e, d) >= 0; d = addDays(d, 1)) {
        if (!weekdays.includes(d.getDay())) continue;
        const date = format(d, "yyyy-MM-dd");
        for (const p of SHIFT_PERIODS.filter((x) => periods.includes(x))) {
          for (let i = 0; i < perShift; i++) {
            const staffId = selected[cursor % selected.length];
            cursor++;
            const key = `${staffId}|${date}|${p}`;
            if (taken.has(key)) continue;
            taken.add(key);
            rows.push({ staff_id: staffId, shift_date: date, period: p, type, created_by: currentUserId, notes: "Auto-generated" });
          }
        }
      }

      if (rows.length === 0) {
        toast.info("Nothing to generate — those shifts already exist");
        setSaving(false);
        return;
      }

      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("shifts").insert(rows.slice(i, i + 200));
        if (error) throw error;
      }
      toast.success(`Generated ${rows.length} shift${rows.length === 1 ? "" : "s"}`);
      setOpen(false);
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Could not generate shifts");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Repeat className="mr-1 h-4 w-4" /> Auto-generate</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Auto-generate repeating shifts</DialogTitle>
          <DialogDescription>Rotate a pool of staff across the selected weekdays and periods. Existing assignments are skipped.</DialogDescription>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Shift type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ShiftType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((t) => <SelectItem key={t} value={t}>{shiftTypeLabel[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Staff per shift</Label>
              <Input type="number" min={1} max={10} value={perShift} onChange={(e) => setPerShift(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Rotation pool</Label>
              <div className="flex items-center gap-2">
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All staff</SelectItem>
                    <SelectItem value="doctor">Doctors</SelectItem>
                    <SelectItem value="nurse">Nurses</SelectItem>
                  </SelectContent>
                </Select>
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
            <p className="mt-1 text-xs text-muted-foreground">{selected.length} selected — staff are rotated evenly in order.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={generate} disabled={saving}>{saving ? "Generating…" : "Generate"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
