import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";
import { downloadCSV, downloadPDF } from "@/lib/export";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — MediRoster" },
      { name: "description", content: "View, cancel, or reschedule hospital appointments." },
      { property: "og:title", content: "Appointments" },
      { property: "og:description", content: "Manage upcoming and past hospital appointments." },
    ],
  }),
  component: ApptsPage,
});

function ApptsPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [past, setPast] = useState<any[]>([]);
  const today = format(new Date(), "yyyy-MM-dd");

  async function load() {
    if (!user) return;
    let query = supabase.from("appointments").select("*, patient:patient_id(full_name, email), doctor:doctor_id(full_name)");
    if (primaryRole === "patient") query = query.eq("patient_id", user.id);
    else if (primaryRole === "doctor") query = query.eq("doctor_id", user.id);
    // admin sees all
    const { data } = await query.order("appt_date", { ascending: false });
    setUpcoming((data ?? []).filter((a: any) => a.appt_date >= today && a.status === "booked"));
    setPast((data ?? []).filter((a: any) => a.appt_date < today || a.status !== "booked"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, primaryRole]);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;

  async function cancel(id: string) {
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Appointment cancelled");
    load();
  }

  function exportCSV(rows: any[], label: string) {
    downloadCSV(`appointments-${label}.csv`, rows.map((a) => ({
      Date: a.appt_date, Time: a.start_time.slice(0,5),
      Patient: a.patient?.full_name ?? "", Doctor: a.doctor?.full_name ?? "",
      Reason: a.reason ?? "", Status: a.status,
    })));
  }
  function exportPDF(rows: any[], label: string) {
    downloadPDF(`appointments-${label}.pdf`, `Appointments (${label})`,
      ["Date","Time","Patient","Doctor","Status"],
      rows.map((a) => [a.appt_date, a.start_time.slice(0,5), a.patient?.full_name ?? "", a.doctor?.full_name ?? "", a.status]));
  }

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{primaryRole === "patient" ? "My appointments" : "Appointments"}</h1>
          {(primaryRole === "admin" || primaryRole === "doctor") && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCSV([...upcoming, ...past], "all")}><Download className="mr-1 h-4 w-4" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => exportPDF([...upcoming, ...past], "all")}><Download className="mr-1 h-4 w-4" /> PDF</Button>
            </div>
          )}
        </div>
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past / Cancelled ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">
            <ApptList rows={upcoming} canCancel={primaryRole === "patient" || primaryRole === "admin"} onCancel={cancel} showPatient={primaryRole !== "patient"} showDoctor={primaryRole !== "doctor"} />
          </TabsContent>
          <TabsContent value="past">
            <ApptList rows={past} canCancel={false} onCancel={cancel} showPatient={primaryRole !== "patient"} showDoctor={primaryRole !== "doctor"} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function ApptList({ rows, canCancel, onCancel, showPatient, showDoctor }: {
  rows: any[]; canCancel: boolean; onCancel: (id: string) => void; showPatient: boolean; showDoctor: boolean;
}) {
  if (rows.length === 0) return <Card><CardContent className="p-6 text-sm text-muted-foreground">No appointments.</CardContent></Card>;
  return (
    <div className="space-y-2">
      {rows.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-sm font-semibold">{format(new Date(a.appt_date), "EEE, MMM d, yyyy")} · {a.start_time.slice(0,5)}</div>
              <div className="text-xs text-muted-foreground">
                {showDoctor && `Doctor: ${a.doctor?.full_name ?? "—"}`}
                {showDoctor && showPatient && " · "}
                {showPatient && `Patient: ${a.patient?.full_name ?? "—"}`}
              </div>
              {a.reason && <div className="mt-1 text-xs">{a.reason}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={a.status === "booked" ? "default" : a.status === "cancelled" ? "destructive" : "secondary"} className="capitalize">{a.status}</Badge>
              {canCancel && a.status === "booked" && (
                <Button size="sm" variant="outline" onClick={() => onCancel(a.id)}>Cancel</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
