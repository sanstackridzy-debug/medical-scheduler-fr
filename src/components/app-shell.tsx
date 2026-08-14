import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { HospitalLogo } from "@/components/hospital-logo";
import type { AppRole, Profile } from "@/lib/auth-hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAvatarUrl, initialsOf } from "@/lib/avatar";
import { LogOut, UserCircle, Calendar, Users, ClipboardList, LayoutDashboard, Bell, Stethoscope, CalendarClock, Building2, Wrench, Award } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface Props {
  children: React.ReactNode;
  profile: Profile | null;
  role: AppRole | null;
}

const navByRole: Record<AppRole, { to: string; label: string; icon: React.ReactNode }[]> = {
  admin: [
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/roster", label: "Duty Roster", icon: <Calendar className="h-4 w-4" /> },
    { to: "/staff", label: "Staff", icon: <Users className="h-4 w-4" /> },
    { to: "/departments", label: "Departments", icon: <Building2 className="h-4 w-4" /> },
    { to: "/skills", label: "Skills & Rules", icon: <Award className="h-4 w-4" /> },
    { to: "/requests", label: "Requests", icon: <ClipboardList className="h-4 w-4" /> },
    { to: "/appointments", label: "Appointments", icon: <CalendarClock className="h-4 w-4" /> },
    { to: "/queue", label: "Queue", icon: <QrCode className="h-4 w-4" /> },
  ],

  doctor: [
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/roster", label: "Duty Roster", icon: <Calendar className="h-4 w-4" /> },
    { to: "/requests", label: "My Requests", icon: <ClipboardList className="h-4 w-4" /> },
    { to: "/appointments", label: "Appointments", icon: <CalendarClock className="h-4 w-4" /> },
    { to: "/queue", label: "Queue", icon: <QrCode className="h-4 w-4" /> },
  ],
  nurse: [
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/roster", label: "Duty Roster", icon: <Calendar className="h-4 w-4" /> },
    { to: "/requests", label: "My Requests", icon: <ClipboardList className="h-4 w-4" /> },
    { to: "/queue", label: "Queue", icon: <QrCode className="h-4 w-4" /> },
  ],
  patient: [
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/book", label: "Book Appointment", icon: <Stethoscope className="h-4 w-4" /> },
    { to: "/appointments", label: "My Appointments", icon: <CalendarClock className="h-4 w-4" /> },
    { to: "/queue", label: "Queue", icon: <QrCode className="h-4 w-4" /> },
  ],
};

export function AppShell({ children, profile, role }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [unread, setUnread] = useState(0);
  const avatarUrl = useAvatarUrl(profile?.avatar_url);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null)
      .then(({ count }) => setUnread(count ?? 0));
  }, [profile]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const nav = role ? navByRole[role] : [];

  return (
    <div className="flex min-h-screen flex-col bg-secondary/40">
      <header className="sticky top-0 z-30 border-b bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <HospitalLogo />
          </Link>
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-accent-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
                activeOptions={{ exact: true }}
              >
                {n.icon}
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/notifications" className="relative rounded-md p-2 hover:bg-accent">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread}
                </span>
              )}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {initialsOf(profile?.full_name)}
                    </div>
                  )}
                  <span className="hidden text-sm sm:inline">{profile?.full_name ?? "..."}</span>
                  {role && <Badge variant="secondary" className="capitalize">{role}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <UserCircle className="mr-2 h-4 w-4" /> My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav className="flex overflow-x-auto border-t bg-card md:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex flex-1 min-w-max items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-foreground/70 [&.active]:border-b-2 [&.active]:border-primary [&.active]:text-primary"
              activeOptions={{ exact: true }}
            >
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
