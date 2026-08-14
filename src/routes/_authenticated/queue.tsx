import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import QRCode from "qrcode";
import { QrCode, RefreshCw, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/queue")({
  head: () => ({
    meta: [
      { title: "Walk-in Queue — MediRoster" },
      { name: "description", content: "Scan a QR code to join the hospital walk-in queue and track your live position." },
      { property: "og:title", content: "Walk-in Queue" },
      { property: "og:description", content: "Conflict-free digital queueing for hospital walk-in patients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QueuePage,
});

type Ticket = {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  ticket_number: number;
  status: string;
  reason: string | null;
  queue_date: string;
  created_at: string;
  patient?: { full_name: string | null } | null;
  doctor?: { full_name: string | null } | null;
};

const statusTone: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800 border-amber-200",
  called: "bg-blue-100 text-blue-800 border-blue-200",
  serving: "bg-emerald-100 text-emerald-800 border-emerald-200",
  done: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function QueuePage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [qr, setQr] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const isStaff = primaryRole === "admin" || primaryRole === "doctor" || primaryRole === "nurse";
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/queue` : "/queue";

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("queue_tickets")
      .select("*, patient:patient_id(full_name), doctor:doctor_id(full_name)")
      .eq("queue_date", todayISO())
      .order("ticket_number", { ascending: true });
    setTickets((data ?? []) as unknown as Ticket[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    QRCode.toDataURL(joinUrl, { width: 512, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [joinUrl]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("queue-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;

  const active = tickets.filter((t) => ["waiting", "called", "serving"].includes(t.status));
  const myTicket = active.find((t) => t.patient_id === user.id) ?? null;
  const myPosition = myTicket ? active.filter((t) => t.ticket_number < myTicket.ticket_number).length + 1 : 0;
  const nowServing = tickets.find((t) => t.status === "serving") ?? tickets.find((t) => t.status === "called") ?? null;

  async function joinQueue() {
    setBusy(true);
    const { error } = await supabase.rpc("join_queue", {
      _doctor_id: undefined,
      _reason: reason.trim() || undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setReason("");
    toast.success("You are in the queue");
    load();
  }

  async function setStatus(id: string, status: string) {
    const patch: { status: string; called_at?: string; served_at?: string } = { status };
    if (status === "called") patch.called_at = new Date().toISOString();
    if (status === "done") patch.served_at = new Date().toISOString();
    const { error } = await supabase.from("queue_tickets").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Walk-in Queue</h1>
          <p className="text-sm text-muted-foreground">
            One scan, one ticket number — no double bookings or queue conflicts.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4" /> Scan to join
              </CardTitle>
              <CardDescription>Point a phone camera at this code to take a ticket.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {qr ? (
                <img src={qr} alt="QR code to join the hospital walk-in queue" className="mx-auto w-full max-w-[240px] rounded-lg border bg-white p-3" />
              ) : (
                <div className="mx-auto h-[240px] w-full max-w-[240px] animate-pulse rounded-lg bg-muted" />
              )}
              <p className="break-all text-center text-xs text-muted-foreground">{joinUrl}</p>
              <div className="rounded-lg border bg-muted/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">Now serving</p>
                <p className="text-3xl font-semibold">{nowServing ? `#${nowServing.ticket_number}` : "—"}</p>
                <p className="text-xs text-muted-foreground">{active.length} waiting today</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> {isStaff ? "Today's queue" : "Your ticket"}
                </CardTitle>
                <CardDescription>
                  {isStaff ? "Call patients in order to keep the flow conflict-free." : "Your live position updates automatically."}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isStaff && (
                <>
                  {myTicket ? (
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Your ticket</p>
                          <p className="text-4xl font-semibold">#{myTicket.ticket_number}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={statusTone[myTicket.status]}>{myTicket.status}</Badge>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {myPosition === 1 ? "You're next" : `${myPosition - 1} ahead of you`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setStatus(myTicket.id, "cancelled")}
                      >
                        Leave queue
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border p-4">
                      <Input
                        placeholder="Reason for visit (optional)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <Button onClick={joinQueue} disabled={busy} className="w-full">
                        {busy ? "Joining…" : "Join the queue"}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {isStaff && (
                <div className="divide-y rounded-lg border">
                  {active.length === 0 && (
                    <p className="p-6 text-center text-sm text-muted-foreground">No one in the queue right now.</p>
                  )}
                  {active.map((t, i) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                      <span className="w-14 text-lg font-semibold">#{t.ticket_number}</span>
                      <div className="min-w-40 flex-1">
                        <p className="text-sm font-medium">{t.patient?.full_name ?? "Patient"}</p>
                        <p className="text-xs text-muted-foreground">{t.reason ?? "Walk-in"} · position {i + 1}</p>
                      </div>
                      <Badge variant="outline" className={statusTone[t.status]}>{t.status}</Badge>
                      <div className="flex gap-2">
                        {t.status === "waiting" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "called")}>Call</Button>
                        )}
                        {t.status !== "serving" && (
                          <Button size="sm" onClick={() => setStatus(t.id, "serving")}>Start</Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setStatus(t.id, "done")}>Done</Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus(t.id, "cancelled")}>Skip</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
