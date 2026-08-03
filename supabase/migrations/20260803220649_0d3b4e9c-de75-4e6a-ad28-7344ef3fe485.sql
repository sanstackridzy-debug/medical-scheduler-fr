GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;

GRANT SELECT, INSERT, DELETE ON public.staff_skills TO authenticated;
GRANT ALL ON public.staff_skills TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO authenticated;
GRANT ALL ON public.availability TO service_role;

GRANT SELECT ON public.shift_rules TO authenticated;
GRANT ALL ON public.shift_rules TO service_role;

GRANT SELECT ON public.shift_skill_requirements TO authenticated;
GRANT ALL ON public.shift_skill_requirements TO service_role;