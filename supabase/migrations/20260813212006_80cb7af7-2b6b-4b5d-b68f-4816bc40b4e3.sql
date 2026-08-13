
CREATE TABLE public.queue_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  queue_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  ticket_number integer NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  reason text,
  called_at timestamptz,
  served_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT queue_tickets_status_chk CHECK (status IN ('waiting','called','serving','done','cancelled')),
  CONSTRAINT queue_tickets_unique_number UNIQUE (queue_date, ticket_number)
);

CREATE INDEX queue_tickets_date_status_idx ON public.queue_tickets (queue_date, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_tickets TO authenticated;
GRANT ALL ON public.queue_tickets TO service_role;

ALTER TABLE public.queue_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients manage own tickets" ON public.queue_tickets
  FOR ALL TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Staff view all tickets" ON public.queue_tickets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nurse'));

CREATE POLICY "Staff update tickets" ON public.queue_tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nurse'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor') OR public.has_role(auth.uid(),'nurse'));

CREATE POLICY "Admins manage tickets" ON public.queue_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_queue_tickets_updated_at
BEFORE UPDATE ON public.queue_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_patient_inflow_updated_at();

CREATE OR REPLACE FUNCTION public.join_queue(_doctor_id uuid DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS public.queue_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d date := (now() AT TIME ZONE 'utc')::date;
  existing public.queue_tickets;
  next_num integer;
  result public.queue_tickets;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to join the queue';
  END IF;

  SELECT * INTO existing FROM public.queue_tickets
  WHERE patient_id = auth.uid() AND queue_date = d AND status IN ('waiting','called','serving')
  LIMIT 1;

  IF existing.id IS NOT NULL THEN
    RETURN existing;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('queue_' || d::text));

  SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO next_num
  FROM public.queue_tickets WHERE queue_date = d;

  INSERT INTO public.queue_tickets (patient_id, doctor_id, queue_date, ticket_number, reason)
  VALUES (auth.uid(), _doctor_id, d, next_num, _reason)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_queue(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_queue(uuid, text) TO authenticated;
