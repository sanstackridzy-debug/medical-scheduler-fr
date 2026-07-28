
-- Account status enum
CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'rejected');

-- Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN status public.account_status NOT NULL DEFAULT 'approved',
  ADD COLUMN requested_role public.app_role;

-- Update handle_new_user to support staff pending signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_role text;
  req_specialty uuid;
BEGIN
  req_role := NEW.raw_user_meta_data->>'requested_role';
  BEGIN
    req_specialty := NULLIF(NEW.raw_user_meta_data->>'specialty_id','')::uuid;
  EXCEPTION WHEN others THEN
    req_specialty := NULL;
  END;

  IF req_role IN ('doctor','nurse') THEN
    INSERT INTO public.profiles (id, full_name, email, specialty_id, status, requested_role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
      NEW.email,
      CASE WHEN req_role = 'doctor' THEN req_specialty ELSE NULL END,
      'pending',
      req_role::public.app_role
    )
    ON CONFLICT (id) DO NOTHING;

    -- Notify all admins of new pending account
    INSERT INTO public.notifications (user_id, kind, title, body, related_id)
    SELECT ur.user_id, 'account_pending',
           'New staff signup pending approval',
           COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' requested ' || req_role || ' access.',
           NEW.id
    FROM public.user_roles ur WHERE ur.role = 'admin';

    -- Confirmation to the user
    INSERT INTO public.notifications (user_id, kind, title, body)
    VALUES (NEW.id, 'account_pending',
      'Account pending approval',
      'Your account is awaiting admin approval. You will be notified once reviewed.');
  ELSE
    INSERT INTO public.profiles (id, full_name, email, status)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
      NEW.email,
      'approved'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Approve a pending staff account (admin only)
CREATE OR REPLACE FUNCTION public.approve_staff_account(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.app_role;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve accounts';
  END IF;

  SELECT requested_role INTO r FROM public.profiles WHERE id = _user_id;
  IF r IS NULL THEN
    RAISE EXCEPTION 'No requested role on profile';
  END IF;

  UPDATE public.profiles SET status = 'approved' WHERE id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, r)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_user_id, 'account_approved',
    'Account approved',
    'Your ' || r::text || ' account has been approved. You now have full access.');
END;
$$;

-- Reject a pending staff account (admin only)
CREATE OR REPLACE FUNCTION public.reject_staff_account(_user_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject accounts';
  END IF;

  UPDATE public.profiles SET status = 'rejected' WHERE id = _user_id;

  INSERT INTO public.notifications (user_id, kind, title, body)
  VALUES (_user_id, 'account_rejected',
    'Account request rejected',
    COALESCE(_reason, 'Your staff account request was not approved. Contact your administrator for details.'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_staff_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_staff_account(uuid, text) TO authenticated;
