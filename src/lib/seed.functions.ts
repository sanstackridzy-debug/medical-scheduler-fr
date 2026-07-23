import { createServerFn } from "@tanstack/react-start";

// One-off seeder: creates 2 admins, 5 doctors, 10 nurses. Assigns specialties to doctors.
// Idempotent: skips users that already exist. Password for all seeded users: Password123!
const SEED_PASSWORD = "Password123!";

type SeedUser = {
  email: string;
  full_name: string;
  role: "admin" | "doctor" | "nurse";
  specialty_name?: string;
};

const seedUsers: SeedUser[] = [
  { email: "admin1@hospital.test", full_name: "Alice Admin", role: "admin" },
  { email: "admin2@hospital.test", full_name: "Adam Admin", role: "admin" },
  { email: "dr.smith@hospital.test", full_name: "Dr. John Smith", role: "doctor", specialty_name: "Cardiology" },
  { email: "dr.patel@hospital.test", full_name: "Dr. Priya Patel", role: "doctor", specialty_name: "Cardiology" },
  { email: "dr.garcia@hospital.test", full_name: "Dr. Maria Garcia", role: "doctor", specialty_name: "Pediatrics" },
  { email: "dr.chen@hospital.test", full_name: "Dr. Wei Chen", role: "doctor", specialty_name: "Pediatrics" },
  { email: "dr.jones@hospital.test", full_name: "Dr. Robert Jones", role: "doctor", specialty_name: "General Surgery" },
  ...Array.from({ length: 10 }, (_, i) => ({
    email: `nurse${i + 1}@hospital.test`,
    full_name: `Nurse ${["Anna", "Ben", "Cara", "Dan", "Eva", "Finn", "Grace", "Henry", "Iris", "Jack"][i]}`,
    role: "nurse" as const,
  })),
];

export const runSeed = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: specs } = await supabaseAdmin.from("specialties").select("id, name");
  const specMap = new Map((specs ?? []).map((s: any) => [s.name, s.id]));

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const existingByEmail = new Map(
    (existing?.users ?? []).map((u) => [u.email?.toLowerCase() ?? "", u]),
  );

  const results: any[] = [];
  for (const u of seedUsers) {
    let userId: string | undefined = existingByEmail.get(u.email.toLowerCase())?.id;
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (error) {
        results.push({ email: u.email, error: error.message });
        continue;
      }
      userId = created.user!.id;
    }
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: u.full_name,
      email: u.email,
      specialty_id: u.specialty_name ? specMap.get(u.specialty_name) ?? null : null,
    });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: u.role });
    results.push({ email: u.email, role: u.role });
  }

  return { ok: true, password: SEED_PASSWORD, count: results.length, users: results };
});
