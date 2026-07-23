import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "Requests — MediRoster" },
      { name: "description", content: "Submit and approve shift swap and leave requests." },
      { property: "og:title", content: "Staff Requests" },
      { property: "og:description", content: "Manage shift swap and leave requests." },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [rows, setRows] = useState<any[]>([]);
  const isAdmin = primaryRole === "admin";
  const isStaff = primaryRole === "doctor" || primaryRole === "nurse";

  async function load() {
    if (!user) return;
    let q = supabase.from("requests").select("*, profiles:staff_id(full_name, email)");
    if (!isAdmin) q = q.eq("staff_id", user.id);
    const { data } = await q.order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, isAdmin]);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;

  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("requests").update({
      status, reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    // notify staff
    const req = rows.find((r) => r.id === id);
    if (req) {
      await supabase.from("notifications").insert({
        user_id: req.staff_id, kind: "request_" + status, title: `Request ${status}`,
        body: `Your ${req.request_type} request has been ${status}.`, related_id: id,
      });
    }
    toast.success(`Request ${status}`);
    load();
  }

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{isAdmin ? "All requests" : "My requests"}</h1>
          {isStaff && <NewRequestDialog userId={user.id} onDone={load} />}
        </div>
        {rows.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No requests yet.</CardContent></Card>
        ) : rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="capitalize">{r.request_type}</span>
                  <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "destructive"} className="capitalize">{r.status}</Badge>
                </div>
                {isAdmin && <div className="text-xs text-muted-foreground">{r.profiles?.full_name}</div>}
                <div className="text-xs">
                  {r.request_type === "leave" && r.leave_start && `${r.leave_start} → ${r.leave_end}`}
                  {r.request_type === "swap" && r.shift_id && `Shift ID: ${r.shift_id.slice(0,8)}…`}
                </div>
                {r.reason && <div className="mt-1 text-xs italic">"{r.reason}"</div>}
                <div className="mt-1 text-[10px] text-muted-foreground">{format(new Date(r.created_at), "PPp")}</div>
              </div>
              {isAdmin && r.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

function NewRequestDialog({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"swap" | "leave">("leave");
  const [reason, setReason] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const payload: any = { staff_id: userId, request_type: type, reason: reason || null };
    if (type === "leave") { payload.leave_start = leaveStart; payload.leave_end = leaveEnd; }
    const { error } = await supabase.from("requests").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Request submitted");
    setOpen(false);
    setReason(""); setLeaveStart(""); setLeaveEnd("");
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> New request</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New request</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="swap">Shift swap</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "leave" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From</Label><Input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} /></div>
            </div>
          )}
          <div><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
