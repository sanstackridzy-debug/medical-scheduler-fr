import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HospitalLogo } from "@/components/hospital-logo";
import { Calendar, ClipboardList, Stethoscope, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediRoster — Hospital Duty & Appointment System" },
      { name: "description", content: "Manage hospital duty rosters, staff shift swaps, and patient appointments in one place." },
      { property: "og:title", content: "MediRoster" },
      { property: "og:description", content: "Hospital duty rosters, shift management, and patient appointments." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-accent">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <HospitalLogo />
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth">Get started</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The calm way to run <span className="text-primary">hospital duty schedules</span>.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Assign shifts, prevent double-booking, approve swap requests, and let patients book with doctors — all in one clean workspace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Sign in to your account</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/seed">Seed demo accounts</Link></Button>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {[
            { icon: <Calendar className="h-6 w-6" />, title: "Monthly roster", body: "Morning, afternoon, and night shifts on one big calendar." },
            { icon: <Users className="h-6 w-6" />, title: "Role-based access", body: "Admins, doctors, nurses, and patients each see the right screens." },
            { icon: <ClipboardList className="h-6 w-6" />, title: "Swap & leave", body: "Staff request time off — admin approves in one click." },
            { icon: <Stethoscope className="h-6 w-6" />, title: "Appointments", body: "Patients book 30-minute slots only when the doctor is on duty." },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="p-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{f.icon}</div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-muted-foreground">
        MediRoster · Hospital Duty Management
      </footer>
    </div>
  );
}
