import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCSV } from "@/lib/export";

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

function StaffPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("user_roles")
      .select("role, user_id, profiles:user_id(id, full_name, email, phone, specialties:specialty_id(name))")
      .in("role", ["admin", "doctor", "nurse"])
      .order("role")
      .then(({ data }) => {
        setRows((data ?? []).map((r: any) => ({ role: r.role, ...r.profiles })));
      });
  }, []);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (primaryRole !== "admin") return <AppShell profile={profile} role={primaryRole}><Card><CardContent className="p-6">Admins only.</CardContent></Card></AppShell>;

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Staff directory</h1>
          <Button variant="outline" size="sm" onClick={() => downloadCSV("staff.csv", rows.map((r) => ({
            Name: r.full_name, Email: r.email, Role: r.role, Specialty: r.specialties?.name ?? "", Phone: r.phone ?? "",
          })))}><Download className="mr-1 h-4 w-4" /> CSV</Button>
        </div>
        <Card>
          <CardHeader><CardTitle>{rows.length} team members</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Specialty</TableHead><TableHead>Email</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.role}</Badge></TableCell>
                    <TableCell>{r.specialties?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
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
