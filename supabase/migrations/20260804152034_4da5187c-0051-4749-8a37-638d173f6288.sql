CREATE TABLE public.patient_inflow (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inflow_date date NOT NULL UNIQUE,
  actual_count integer,
  predicted_count integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'forecast',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_inflow TO authenticated;
GRANT ALL ON public.patient_inflow TO service_role;

ALTER TABLE public.patient_inflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read forecasts"
  ON public.patient_inflow
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage inflow data"
  ON public.patient_inflow
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_patient_inflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_patient_inflow_updated_at
  BEFORE UPDATE ON public.patient_inflow
  FOR EACH ROW
  EXECUTE FUNCTION public.update_patient_inflow_updated_at();

-- Seed minimal historical data so the forecast engine has something to average
INSERT INTO public.patient_inflow (inflow_date, actual_count, predicted_count, source)
VALUES
  (CURRENT_DATE - INTERVAL '14 days', 42, 42, 'historical'),
  (CURRENT_DATE - INTERVAL '13 days', 55, 55, 'historical'),
  (CURRENT_DATE - INTERVAL '12 days', 48, 48, 'historical'),
  (CURRENT_DATE - INTERVAL '11 days', 60, 60, 'historical'),
  (CURRENT_DATE - INTERVAL '10 days', 52, 52, 'historical'),
  (CURRENT_DATE - INTERVAL '9 days', 47, 47, 'historical'),
  (CURRENT_DATE - INTERVAL '8 days', 58, 58, 'historical'),
  (CURRENT_DATE - INTERVAL '7 days', 44, 44, 'historical'),
  (CURRENT_DATE - INTERVAL '6 days', 56, 56, 'historical'),
  (CURRENT_DATE - INTERVAL '5 days', 49, 49, 'historical'),
  (CURRENT_DATE - INTERVAL '4 days', 61, 61, 'historical'),
  (CURRENT_DATE - INTERVAL '3 days', 53, 53, 'historical'),
  (CURRENT_DATE - INTERVAL '2 days', 46, 46, 'historical'),
  (CURRENT_DATE - INTERVAL '1 day', 54, 54, 'historical')
ON CONFLICT (inflow_date) DO UPDATE SET
  actual_count = EXCLUDED.actual_count,
  predicted_count = EXCLUDED.predicted_count,
  source = EXCLUDED.source;
