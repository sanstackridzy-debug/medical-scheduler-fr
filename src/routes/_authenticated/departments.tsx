import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, Check, X, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Departments — MediRoster" },
      { name: "description", content: "Create, edit, and manage hospital departments and specialties." },
      { property: "og:title", content: "Manage Hospital Departments" },
      { property: "og:description", content: "Admin tools to organize hospital departments and specialties." },
    ],
  }),
  component: DepartmentsPage,
});

type Row = { id: string; name: string; created_at: string; doctor_count: number };

function DepartmentsPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: specs, error } = await supabase
      .from("specialties")
      .select("id, name, created_at")
      .order("name");
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data: docs } = await supabase.from("profiles").select("specialty_id");
    const counts = new Map<string, number>();
    (docs ?? []).forEach((d: any) => {
      if (d.specialty_id) counts.set(d.specialty_id, (counts.get(d.specialty_id) ?? 0) + 1);
    });
    setRows((specs ?? []).map((s: any) => ({ ...s, doctor_count: counts.get(s.id) ?? 0 })));
  }

  useEffect(() => {
    if (primaryRole === "admin") load();
  }, [primaryRole]);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await supabase.from("specialties").insert({ name });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${name}`);
    setNewName("");
    load();
  }

  async function saveEdit(id: string) {
    const name = editingName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await supabase.from("specialties").update({ name }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Department updated");
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("specialties").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Department removed");
    load();
  }

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (primaryRole !== "admin")
    return (
      <AppShell profile={profile} role={primaryRole}>
        <Card><CardContent className="p-6">Admins only.</CardContent></Card>
      </AppShell>
    );

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" /> Departments</h1>
          <p className="text-sm text-muted-foreground">Add, rename, or remove hospital departments and specialties.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Add a department</CardTitle></CardHeader>
          <CardContent>
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); create(); }}
            >
              <Input
                placeholder="e.g. Neurology"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
              />
              <Button type="submit" disabled={busy || !newName.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{rows.length} departments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Doctors</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {editingId === r.id ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        r.name
                      )}
                    </TableCell>
                    <TableCell>{r.doctor_count}</TableCell>
                    <TableCell className="text-right">
                      {editingId === r.id ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => saveEdit(r.id)} disabled={busy}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingId(r.id); setEditingName(r.name); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {r.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {r.doctor_count > 0
                                    ? `${r.doctor_count} doctor(s) are assigned to this department. Their specialty will be cleared.`
                                    : "This department has no assigned doctors."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(r.id)}>Remove</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No departments yet. Add your first one above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
