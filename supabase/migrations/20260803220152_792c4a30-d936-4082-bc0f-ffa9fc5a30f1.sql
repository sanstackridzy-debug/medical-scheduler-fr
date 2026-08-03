CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view skills"
  ON public.skills
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage skills"
  ON public.skills
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.staff_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  expires_at date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_skills TO authenticated;
GRANT ALL ON public.staff_skills TO service_role;

ALTER TABLE public.staff_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skills"
  ON public.staff_skills
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage staff skills"
  ON public.staff_skills
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  availability_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('available', 'unavailable', 'preferred')),
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, availability_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO authenticated;
GRANT ALL ON public.availability TO service_role;

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own availability"
  ON public.availability
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all availability"
  ON public.availability
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.shift_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('max_nights_per_month', 'max_consecutive_days', 'min_rest_hours', 'max_weekends_per_month', 'max_hours_per_week')),
  value integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shift_rules TO authenticated;
GRANT ALL ON public.shift_rules TO service_role;

ALTER TABLE public.shift_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shift rules"
  ON public.shift_rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.shift_skill_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_type shift_type NOT NULL,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  required_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (shift_type, skill_id)
);

GRANT SELECT ON public.shift_skill_requirements TO authenticated;
GRANT ALL ON public.shift_skill_requirements TO service_role;

ALTER TABLE public.shift_skill_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage shift skill requirements"
  ON public.shift_skill_requirements
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.skills (name, description) VALUES
  ('ICU', 'Intensive care unit trained'),
  ('Pediatrics', 'Pediatric care'),
  ('Anesthesia', 'Anesthesia and sedation'),
  ('ACLS', 'Advanced cardiac life support'),
  ('Surgery', 'Surgical assistance'),
  ('ER Trauma', 'Emergency trauma care'),
  ('Ward Care', 'General ward nursing'),
  ('OPD', 'Outpatient department')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.shift_rules (name, rule_type, value, is_active) VALUES
  ('Max night shifts per month', 'max_nights_per_month', 4, true),
  ('Max consecutive working days', 'max_consecutive_days', 6, true),
  ('Minimum rest between shifts (hours)', 'min_rest_hours', 12, true),
  ('Max weekends per month', 'max_weekends_per_month', 2, true),
  ('Max hours per week', 'max_hours_per_week', 48, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.shift_skill_requirements (shift_type, skill_id, required_count)
SELECT 'surgery', id, 1 FROM public.skills WHERE name = 'Surgery'
ON CONFLICT DO NOTHING;

INSERT INTO public.shift_skill_requirements (shift_type, skill_id, required_count)
SELECT 'er', id, 1 FROM public.skills WHERE name = 'ER Trauma'
ON CONFLICT DO NOTHING;

INSERT INTO public.shift_skill_requirements (shift_type, skill_id, required_count)
SELECT 'er', id, 1 FROM public.skills WHERE name = 'ACLS'
ON CONFLICT DO NOTHING;

INSERT INTO public.shift_skill_requirements (shift_type, skill_id, required_count)
SELECT 'ward_duty', id, 1 FROM public.skills WHERE name = 'Ward Care'
ON CONFLICT DO NOTHING;

INSERT INTO public.shift_skill_requirements (shift_type, skill_id, required_count)
SELECT 'opd', id, 1 FROM public.skills WHERE name = 'OPD'
ON CONFLICT DO NOTHING;