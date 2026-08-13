import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HospitalLogo } from "@/components/hospital-logo";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const n = s['next'];
    return typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? { next: n } : {};
  },

  head: () => ({
    meta: [
      { title: "Sign in — MediRoster" },
      { name: "description", content: "Sign in or create your MediRoster hospital account." },
      { property: "og:title", content: "MediRoster Sign In" },
      { property: "og:description", content: "Hospital duty roster and appointments." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [staffRole, setStaffRole] = useState<"doctor" | "nurse">("doctor");
  const [specialtyId, setSpecialtyId] = useState<string>("");
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  function goNext() {
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/dashboard" });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (next) window.location.href = next;
        else navigate({ to: "/dashboard" });
      }
    });
    supabase.from("specialties").select("id, name").order("name").then(({ data }) => {
      setSpecialties(data ?? []);
    });
  }, [navigate, next]);


  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    goNext();
  }

  async function signUpPatient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        data: { full_name: String(fd.get("full_name")) },
        emailRedirectTo: next ? `${window.location.origin}${next}` : window.location.origin,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — signing you in");
    await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    goNext();
  }

  async function signUpStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    const fd = new FormData(form);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        data: {
          full_name: String(fd.get("full_name")),
          requested_role: staffRole,
          specialty_id: staffRole === "doctor" ? specialtyId : "",
        },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Request submitted — an admin will review your account");
    form.reset();
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <HospitalLogo />
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in, create a patient account, or request staff access.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="patient">Patient</TabsTrigger>
                <TabsTrigger value="staff">Staff</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3 pt-4">
                  <div className="space-y-1">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="si-pass">Password</Label>
                    <Input id="si-pass" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="patient">
                <form onSubmit={signUpPatient} className="space-y-3 pt-4">
                  <div className="space-y-1">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" name="full_name" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="su-pass">Password (min 6 chars)</Label>
                    <Input id="su-pass" name="password" type="password" minLength={6} required autoComplete="new-password" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating..." : "Create patient account"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="staff">
                <form onSubmit={signUpStaff} className="space-y-3 pt-4">
                  <p className="rounded-md bg-secondary p-2 text-xs text-muted-foreground">
                    Staff accounts require admin approval before you can sign in.
                  </p>
                  <div className="space-y-1">
                    <Label>Requested role</Label>
                    <Select value={staffRole} onValueChange={(v) => setStaffRole(v as "doctor" | "nurse")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="nurse">Nurse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {staffRole === "doctor" && (
                    <div className="space-y-1">
                      <Label>Specialty</Label>
                      <Select value={specialtyId} onValueChange={setSpecialtyId}>
                        <SelectTrigger><SelectValue placeholder="Select a specialty" /></SelectTrigger>
                        <SelectContent>
                          {specialties.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="st-name">Full name</Label>
                    <Input id="st-name" name="full_name" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="st-email">Email</Label>
                    <Input id="st-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="st-pass">Password (min 6 chars)</Label>
                    <div className="relative">
                      <Input
                        id="st-pass"
                        name="password"
                        type={showStaffPassword ? "text" : "password"}
                        minLength={6}
                        required
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        aria-label={showStaffPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowStaffPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      >
                        {showStaffPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || (staffRole === "doctor" && !specialtyId)}
                  >
                    {loading ? "Submitting..." : "Request staff account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
