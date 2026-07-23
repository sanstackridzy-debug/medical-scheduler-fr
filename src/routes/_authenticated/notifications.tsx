import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MediRoster" },
      { name: "description", content: "In-app duty and appointment reminders." },
      { property: "og:title", content: "Notifications" },
      { property: "og:description", content: "Duty and appointment reminders." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;

  async function markAll() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
    load();
  }

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <Button variant="outline" size="sm" onClick={markAll}>Mark all read</Button>
        </div>
        {rows.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No notifications yet. Duty and appointment reminders will appear here.</CardContent></Card>
        ) : rows.map((n) => (
          <Card key={n.id} className={n.read_at ? "opacity-70" : "border-primary/30"}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{n.title}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(n.created_at), "PPp")}</div>
              </div>
              {n.body && <div className="mt-1 text-sm text-muted-foreground">{n.body}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
