import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Check, X, Trash2, KeyRound } from "lucide-react";
import { downloadCSV } from "@/lib/export";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { deleteUserAccount, resetUserPassword } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff — MediRoster" },
      { name: "description", content: "Directory of all hospital staff and their roles." },
      { property: "og:title", content: "Staff Directory" },
      { property: "og:description", content: "Hospital staff, roles, and specialties." },
    ],
  }),
  component: StaffPage,
});

type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  specialties?: { name: string } | null;
};

type PendingRow = {
  id: string;
  full_name: string;
  email: string;
  requested_role: string;
  specialties?: { name: string } | null;
  created_at: string;
};

function StaffPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const deleteFn = useServerFn(deleteUserAccount);
  const resetFn = useServerFn(resetUserPassword);
  const [resetTarget, setResetTarget] = useState<Row | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    const [staffRes, pendingRes] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role, user_id, profiles:user_id(id, full_name, email, phone, specialties:specialty_id(name))")
        .order("role"),
      supabase
        .from("profiles")
        .select("id, full_name, email, requested_role, created_at, specialties:specialty_id(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    setRows(((staffRes.data ?? []) as any[]).map((r) => ({ role: r.role, ...r.profiles })));
    setPending((pendingRes.data ?? []) as any[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (primaryRole !== "admin") {
    return (
      <AppShell profile={profile} role={primaryRole}>
        <Card><CardContent className="p-6">Admins only.</CardContent></Card>
      </AppShell>
    );
  }

  async function approve(id: string) {
    const { error } = await supabase.rpc("approve_staff_account", { _user_id: id });
    if (error) return toast.error(error.message);
    toast.success("Account approved");
    load();
  }

  async function reject(id: string) {
    const { error } = await supabase.rpc("reject_staff_account", { _user_id: id });
    if (error) return toast.error(error.message);
    toast.success("Account rejected");
    load();
  }

  async function remove(id: string) {
    try {
      await deleteFn({ data: { userId: id } });
      toast.success("Account deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete account");
    }
  }

  async function doReset() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await resetFn({ data: { userId: resetTarget.id, newPassword } });
      toast.success(`Password reset for ${resetTarget.full_name}`);
      setResetTarget(null);
      setNewPassword("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reset password");
    } finally {
      setResetting(false);
    }
  }


  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Staff directory</h1>
          <Button variant="outline" size="sm" onClick={() => downloadCSV("staff.csv", rows.map((r) => ({
            Name: r.full_name, Email: r.email, Role: r.role, Specialty: r.specialties?.name ?? "", Phone: r.phone ?? "",
          })))}><Download className="mr-1 h-4 w-4" /> CSV</Button>
        </div>

        {pending.length > 0 && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Pending approvals
                <Badge variant="destructive">{pending.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Requested</TableHead><TableHead>Specialty</TableHead>
                  <TableHead>Email</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pending.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{p.requested_role}</Badge></TableCell>
                      <TableCell>{p.specialties?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="default" onClick={() => approve(p.id)}>
                          <Check className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reject(p.id)}>
                          <X className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>{rows.length} team members</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Specialty</TableHead>
                <TableHead>Email</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.id}-${r.role}`}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.role}</Badge></TableCell>
                    <TableCell>{r.specialties?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Reset password"
                          onClick={() => { setResetTarget(r); setNewPassword(""); }}
                        >
                          <KeyRound className="h-3 w-3" />
                        </Button>
                      )}
                      {r.role !== "admin" && r.id !== user.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {r.full_name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes the user account and all their data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(r.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
