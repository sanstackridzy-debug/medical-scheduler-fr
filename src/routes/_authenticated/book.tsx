import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { isDoctorOnDuty } from "@/lib/shift-utils";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "Book Appointment — MediRoster" },
      { name: "description", content: "Book a 30-minute appointment with an available hospital doctor." },
      { property: "og:title", content: "Book Appointment" },
      { property: "og:description", content: "Choose a doctor, date, and available time slot." },
    ],
  }),
  component: BookPage,
});

const HOURS = Array.from({ length: 20 }, (_, i) => {
  const total = 8 * 60 + i * 30; // 08:00 to 17:30
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

function BookPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [reason, setReason] = useState("");
  const [doctorShifts, setDoctorShifts] = useState<any[]>([]);
  const [dutyMap, setDutyMap] = useState<Record<string, string[]>>({});
  const [existingAppts, setExistingAppts] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.rpc("list_doctors").then(({ data, error }) => {
      if (error) {
        toast.error("Could not load doctors");
        return;
      }
      setDoctors(
        (data ?? []).map((d: any) => ({
          id: d.id,
          full_name: d.full_name,
          specialties: d.specialty_name ? { name: d.specialty_name } : null,
        })),
      );
    });
  }, []);

  useEffect(() => {
    if (!doctorId || !date) return;
    supabase.from("shifts").select("shift_date, period").eq("staff_id", doctorId).eq("shift_date", date).then(({ data }) => setDoctorShifts(data ?? []));
    supabase.from("appointments").select("start_time").eq("doctor_id", doctorId).eq("appt_date", date).eq("status", "booked").then(({ data }) => setExistingAppts(data ?? []));
  }, [doctorId, date]);

  const availableSlots = useMemo(() => {
    if (!doctorId) return [];
    const taken = new Set(existingAppts.map((a) => a.start_time.slice(0, 5)));
    return HOURS.filter((h) => !taken.has(h) && isDoctorOnDuty(doctorShifts, date, h));
  }, [doctorId, existingAppts, doctorShifts, date]);

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === doctorId), [doctors, doctorId]);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;

  async function book() {
    if (!selectedSlot) return;
    setSaving(true);
    const [h, m] = selectedSlot.split(":").map(Number);
    const endMin = h * 60 + m + 30;
    const end = `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`;
    const { error } = await supabase.from("appointments").insert({
      patient_id: user!.id,
      doctor_id: doctorId,
      appt_date: date,
      start_time: selectedSlot,
      end_time: end,
      reason: reason || null,
    });
    setSaving(false);
    setConfirmOpen(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment booked");
    setReason("");
    setSelectedSlot(null);
    // Refresh slots
    const { data } = await supabase.from("appointments").select("start_time").eq("doctor_id", doctorId).eq("appt_date", date).eq("status", "booked");
    setExistingAppts(data ?? []);
    // Notify patient (in-app reminder placeholder)
    await supabase.from("notifications").insert({
      user_id: user!.id,
      kind: "appointment_booked",
      title: "Appointment confirmed",
      body: `You have an appointment on ${date} at ${selectedSlot}.`,
    });
  }

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Book an appointment</h1>
        <Card>
          <CardHeader>
            <CardTitle>Choose doctor and date</CardTitle>
            <CardDescription>Only slots when the doctor is on OPD / Ward duty are shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Doctor</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger><SelectValue placeholder="Select a doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.full_name}{d.specialties?.name ? ` — ${d.specialties.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={format(new Date(), "yyyy-MM-dd")} />
              </div>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly describe your visit" />
            </div>
          </CardContent>
        </Card>

        {doctorId && (
          <Card>
            <CardHeader>
              <CardTitle>Available slots</CardTitle>
              <CardDescription>{availableSlots.length} open on {format(new Date(date), "MMM d")}</CardDescription>
            </CardHeader>
            <CardContent>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slots available. Doctor isn't on OPD/ward duty this date, or all slots are booked.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {availableSlots.map((s) => (
                    <Button
                      key={s}
                      variant={selectedSlot === s ? "default" : "outline"}
                      onClick={() => { setSelectedSlot(s); setConfirmOpen(true); }}
                      disabled={saving}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm appointment</DialogTitle>
            <DialogDescription>Review your appointment details before booking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            <div><span className="text-muted-foreground">Doctor:</span> {selectedDoctor?.full_name ?? "—"}{selectedDoctor?.specialties?.name ? ` — ${selectedDoctor.specialties.name}` : ""}</div>
            <div><span className="text-muted-foreground">Date:</span> {format(new Date(date), "EEEE, MMMM d, yyyy")}</div>
            <div><span className="text-muted-foreground">Time:</span> {selectedSlot} – {selectedSlot && (() => {
              const [h, m] = selectedSlot.split(":").map(Number);
              const endMin = h * 60 + m + 30;
              return `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`;
            })()}</div>
            {reason && <div><span className="text-muted-foreground">Reason:</span> {reason}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setSelectedSlot(null); }} disabled={saving}>Cancel</Button>
            <Button onClick={book} disabled={saving}>{saving ? "Booking…" : "Confirm appointment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
