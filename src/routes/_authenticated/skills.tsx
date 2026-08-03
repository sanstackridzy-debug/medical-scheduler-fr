import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession, useMyProfile } from "@/lib/auth-hooks";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { SHIFT_TYPES, shiftTypeLabel, type ShiftType } from "@/lib/shift-utils";
import type { ShiftRule } from "@/lib/scheduling";

export const Route = createFileRoute("/_authenticated/skills")({
  head: () => ({
    meta: [
      { title: "Skills & Rules — MediRoster" },
      { name: "description", content: "Manage skills, shift skill requirements, and scheduling rules for the smart scheduler." },
      { property: "og:title", content: "Skills & Rules — MediRoster" },
      { property: "og:description", content: "Manage skills, shift skill requirements, and scheduling rules for the smart scheduler." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SkillsPage,
});

function SkillsPage() {
  const { user, loading } = useSession();
  const { profile, primaryRole, loading: pLoading } = useMyProfile(user);
  const [activeTab, setActiveTab] = useState("skills");

  if (loading || pLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (primaryRole !== "admin") return <div className="p-8 text-center text-muted-foreground">Admins only.</div>;

  return (
    <AppShell profile={profile} role={primaryRole}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Skills & Rules</h1>
          <p className="text-sm text-muted-foreground">Configure skills, shift requirements, and fairness rules for the smart scheduler.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="requirements">Skill Requirements</TabsTrigger>
            <TabsTrigger value="rules">Scheduling Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="skills" className="space-y-4">
            <SkillsTab />
          </TabsContent>
          <TabsContent value="requirements" className="space-y-4">
            <SkillRequirementsTab />
          </TabsContent>
          <TabsContent value="rules" className="space-y-4">
            <RulesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function SkillsTab() {
  const [skills, setSkills] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  async function load() {
    const { data } = await supabase.from("skills").select("*").order("name");
    setSkills(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!newName.trim()) return;
    const { error } = await supabase.from("skills").insert({ name: newName.trim(), description: newDesc.trim() || null });
    if (error) return toast.error(error.message);
    setNewName(""); setNewDesc("");
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("skills").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
        <CardDescription>Define skills that staff can assign to themselves (e.g., ICU, ACLS, ER Trauma).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Skill name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
          <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="flex-[2]" />
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
        <div className="space-y-2">
          {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills yet.</p>}
          {skills.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.description}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SkillRequirementsTab() {
  const [skills, setSkills] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [shiftType, setShiftType] = useState<ShiftType>("ward_duty");
  const [skillId, setSkillId] = useState("");
  const [count, setCount] = useState(1);

  async function load() {
    const [{ data: skillsData }, { data: reqData }] = await Promise.all([
      supabase.from("skills").select("*").order("name"),
      supabase.from("shift_skill_requirements").select("*, skills:skill_id(name)").order("shift_type"),
    ]);
    setSkills(skillsData ?? []);
    setRequirements(reqData ?? []);
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!skillId) return;
    const { error } = await supabase.from("shift_skill_requirements").insert({ shift_type: shiftType, skill_id: skillId, required_count: count });
    if (error) return toast.error(error.message);
    setSkillId("");
    setCount(1);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("shift_skill_requirements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift skill requirements</CardTitle>
        <CardDescription>Require a minimum number of staff with specific skills for each shift type.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={shiftType} onValueChange={(v) => setShiftType(v as ShiftType)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SHIFT_TYPES.map((t) => <SelectItem key={t} value={t}>{shiftTypeLabel[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={skillId} onValueChange={setSkillId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Skill" /></SelectTrigger>
            <SelectContent>
              {skills.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} className="w-28" />
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
        <div className="space-y-2">
          {requirements.length === 0 && <p className="text-sm text-muted-foreground">No requirements set.</p>}
          {requirements.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Badge className="capitalize">{shiftTypeLabel[r.shift_type as ShiftType]}</Badge>
                <span className="mx-2 text-sm">requires</span>
                <span className="font-medium">{r.required_count}</span>
                <span className="text-sm">× {r.skills?.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}

        </div>
      </CardContent>
    </Card>
  );
}

const RULE_TYPES: { value: ShiftRule["rule_type"]; label: string; unit: string }[] = [
  { value: "max_nights_per_month", label: "Max night shifts per month", unit: "shifts" },
  { value: "max_consecutive_days", label: "Max consecutive work days", unit: "days" },
  { value: "min_rest_hours", label: "Minimum rest between shifts", unit: "hours" },
  { value: "max_weekends_per_month", label: "Max weekends per month", unit: "weekends" },
  { value: "max_hours_per_week", label: "Max hours per week", unit: "hours" },
];

function RulesTab() {
  const [rules, setRules] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState<ShiftRule["rule_type"]>("max_nights_per_month");
  const [value, setValue] = useState(4);

  async function load() {
    const { data } = await supabase.from("shift_rules").select("*").order("name");
    setRules(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("shift_rules").insert({ name: name.trim(), rule_type: ruleType, value, is_active: true });
    if (error) return toast.error(error.message);
    setName("");
    setValue(4);
    load();
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("shift_rules").update({ is_active: !active }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("shift_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduling rules</CardTitle>
        <CardDescription>Fairness and fatigue rules enforced by the smart scheduler.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
          <Select value={ruleType} onValueChange={(v) => setRuleType(v as ShiftRule["rule_type"])}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RULE_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={1} value={value} onChange={(e) => setValue(Math.max(1, Number(e.target.value) || 1))} className="w-24" />
          <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
        <div className="space-y-2">
          {rules.length === 0 && <p className="text-sm text-muted-foreground">No rules yet.</p>}
          {rules.map((r) => {
            const typeInfo = RULE_TYPES.find((t) => t.value === r.rule_type);
            return (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <div className="font-medium flex items-center gap-2">
                    {r.name}
                    <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{typeInfo?.label}: {r.value} {typeInfo?.unit}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleActive(r.id, r.is_active)}>
                    <Save className="mr-1 h-4 w-4" /> {r.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
