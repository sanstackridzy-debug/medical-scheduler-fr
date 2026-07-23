import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runSeed } from "@/lib/seed.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HospitalLogo } from "@/components/hospital-logo";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/seed")({
  head: () => ({
    meta: [
      { title: "Seed demo accounts — MediRoster" },
      { name: "description", content: "Provision the sample admin, doctor, and nurse accounts to try MediRoster." },
      { property: "og:title", content: "Seed demo accounts" },
      { property: "og:description", content: "Provision sample MediRoster accounts." },
    ],
  }),
  component: SeedPage,
});

function SeedPage() {
  const seed = useServerFn(runSeed);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function go() {
    setLoading(true);
    try {
      const r = await seed();
      setResult(r);
      toast.success(`Seeded ${r.count} accounts`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6 flex justify-center"><HospitalLogo /></div>
      <Card>
        <CardHeader>
          <CardTitle>Seed sample accounts</CardTitle>
          <CardDescription>
            Creates 2 admins, 5 doctors (across Cardiology, Pediatrics, General Surgery), and 10 nurses.
            Password for every seeded account: <code className="rounded bg-secondary px-1.5 py-0.5">Password123!</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={go} disabled={loading} size="lg" className="w-full">
            {loading ? "Provisioning…" : "Provision sample accounts"}
          </Button>
          {result && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Created / verified {result.count} accounts:</div>
              <div className="max-h-64 overflow-y-auto rounded border p-3 text-xs">
                {result.users?.map((u: any) => (
                  <div key={u.email} className="flex items-center justify-between border-b py-1 last:border-b-0">
                    <span>{u.email}</span>
                    {u.error
                      ? <Badge variant="destructive">{u.error}</Badge>
                      : <Badge variant="secondary" className="capitalize">{u.role}</Badge>}
                  </div>
                ))}
              </div>
              <Button asChild className="w-full"><Link to="/auth">Continue to sign-in →</Link></Button>
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">Idempotent — safe to re-run.</p>
        </CardContent>
      </Card>
    </div>
  );
}
