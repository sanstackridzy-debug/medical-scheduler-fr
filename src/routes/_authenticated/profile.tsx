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
import { Camera, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — MediRoster" },
      { name: "description", content: "Update your MediRoster profile picture and contact details." },
      { property: "og:title", content: "My Profile — MediRoster" },
      { property: "og:description", content: "Update your profile picture and contact details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);

  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarUrl = useAvatarUrl(avatarPath);

  useEffect(() => {
    if (profile) {
      setAvatarPath(profile.avatar_url ?? null);
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

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
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your profile picture and contact details.</p>
        </div>

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
      </div>
    </AppShell>
  );
}
