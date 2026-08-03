import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAvatarUrl, initialsOf } from "@/lib/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addDays, format, getDay, startOfWeek, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AvailabilityStatus } from "@/lib/scheduling";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — MediRoster" },
      { name: "description", content: "Update your MediRoster profile picture, contact details, skills, and availability." },
      { property: "og:title", content: "My Profile — MediRoster" },
      { property: "og:description", content: "Update your profile picture, contact details, skills, and availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string; color: string }[] = [
  { value: "preferred", label: "Preferred", color: "bg-emerald-500 text-white" },
  { value: "available", label: "Available", color: "bg-primary text-primary-foreground" },
  { value: "unavailable", label: "Unavailable", color: "bg-muted text-muted-foreground" },
];

function ProfilePage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);

  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarUrl = useAvatarUrl(avatarPath);

  const [skills, setSkills] = useState<any[]>([]);
  const [staffSkills, setStaffSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});

  useEffect(() => {
    if (profile) {
      setAvatarPath(profile.avatar_url ?? null);
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    loadSkills();
    loadAvailability();
  }, [user]);

  async function loadSkills() {
    const [{ data: skillsData }, { data: staffSkillsData }] = await Promise.all([
      supabase.from("skills").select("*").order("name"),
      supabase.from("staff_skills").select("skill_id").eq("user_id", user!.id),
    ]);
    setSkills(skillsData ?? []);
    setStaffSkills((staffSkillsData ?? []).map((s: any) => s.skill_id));
  }

  async function loadAvailability() {
    const today = new Date();
    const start = format(today, "yyyy-MM-dd");
    const end = format(addDays(today, 90), "yyyy-MM-dd");
    const { data } = await supabase
      .from("availability")
      .select("availability_date, status")
      .eq("user_id", user!.id)
      .gte("availability_date", start)
      .lte("availability_date", end);
    const map: Record<string, AvailabilityStatus> = {};
    for (const row of (data ?? []) as any) {
      map[row.availability_date] = row.status;
    }
    setAvailability(map);
  }

  async function toggleSkill(skillId: string) {
    if (!user) return;
    const has = staffSkills.includes(skillId);
    if (has) {
      await supabase.from("staff_skills").delete().eq("user_id", user.id).eq("skill_id", skillId);
      setStaffSkills((prev) => prev.filter((id) => id !== skillId));
    } else {
      await supabase.from("staff_skills").insert({ user_id: user.id, skill_id: skillId });
      setStaffSkills((prev) => [...prev, skillId]);
    }
  }

  async function setDayStatus(date: string, status: AvailabilityStatus) {
    if (!user) return;
    const current = availability[date];
    if (current === status) {
      await supabase.from("availability").delete().eq("user_id", user.id).eq("availability_date", date);
      setAvailability((prev) => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
    } else {
      await supabase.from("availability").upsert({ user_id: user.id, availability_date: date, status }, { onConflict: "user_id,availability_date" });
      setAvailability((prev) => ({ ...prev, [date]: status }));
    }
  }

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be smaller than 5 MB.");

    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
    setAvatarPath(path);
    setBusy(false);
    toast.success("Profile picture updated");
  }

  async function removePhoto() {
    if (!user || !avatarPath) return;
    setBusy(true);
    await supabase.storage.from("avatars").remove([avatarPath]);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setAvatarPath(null);
    toast.success("Profile picture removed");
  }

  async function savePhone() {
    if (!user) return;
    setSavingPhone(true);
    const { error } = await supabase.from("profiles").update({ phone: phone || null }).eq("id", user.id);
    setSavingPhone(false);
    if (error) return toast.error(error.message);
    toast.success("Details saved");
  }

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your profile picture, contact details, skills, and availability.</p>
        </div>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile picture</CardTitle>
                <CardDescription>PNG or JPG, up to 5 MB.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-6">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${profile?.full_name ?? "User"} profile picture`}
                      className="h-24 w-24 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                      {initialsOf(profile?.full_name)}
                    </div>
                  )}
                  {busy && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
                  <Button onClick={() => fileRef.current?.click()} disabled={busy} className="gap-2">
                    <Camera className="h-4 w-4" /> {avatarPath ? "Change photo" : "Upload photo"}
                  </Button>
                  {avatarPath && (
                    <Button variant="outline" onClick={removePhoto} disabled={busy} className="gap-2">
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account details</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {primaryRole && <Badge variant="secondary" className="capitalize">{primaryRole}</Badge>}
                  <span>{profile?.email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={profile?.full_name ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
                </div>
                <Button onClick={savePhone} disabled={savingPhone}>
                  {savingPhone ? "Saving…" : "Save details"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My skills</CardTitle>
                <CardDescription>Mark the skills that apply to you. Admins use these for skill-based scheduling.</CardDescription>
              </CardHeader>
              <CardContent>
                {skills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No skills have been defined yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {skills.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 rounded-md border p-3">
                        <Checkbox checked={staffSkills.includes(s.id)} onCheckedChange={() => toggleSkill(s.id)} />
                        <div className="flex-1">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="availability" className="space-y-6">
            <AvailabilityCalendar availability={availability} onSet={setDayStatus} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function AvailabilityCalendar({ availability, onSet }: { availability: Record<string, AvailabilityStatus>; onSet: (d: string, s: AvailabilityStatus) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const base = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const days = Array.from({ length: 14 }, (_, i) => addDays(base, i));
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Availability</CardTitle>
            <CardDescription>Set your preferred and unavailable days for smart scheduling.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>Next</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {weekdayLabels.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground">{d}</div>
          ))}
          {days.map((d) => {
            const date = format(d, "yyyy-MM-dd");
            const status = availability[date];
            const opt = STATUS_OPTIONS.find((o) => o.value === status);
            return (
              <div key={date} className="space-y-1">
                <div className="text-center text-xs text-muted-foreground">{format(d, "d")}</div>
                <div className="flex flex-col gap-1">
                  {STATUS_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => onSet(date, o.value)}
                      className={`rounded px-1 py-1 text-[10px] font-medium transition-opacity ${status === o.value ? o.color : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {STATUS_OPTIONS.map((o) => (
            <div key={o.value} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded ${o.color}`} />
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
