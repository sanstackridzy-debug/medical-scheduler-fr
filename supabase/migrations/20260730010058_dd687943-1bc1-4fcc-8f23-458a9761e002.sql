CREATE OR REPLACE FUNCTION public.list_doctors()
RETURNS TABLE (id uuid, full_name text, specialty_id uuid, specialty_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.specialty_id, s.name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'doctor'
  LEFT JOIN public.specialties s ON s.id = p.specialty_id
  WHERE p.status = 'approved'
  ORDER BY p.full_name
$$;

REVOKE ALL ON FUNCTION public.list_doctors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_doctors() TO authenticated;