
ALTER TABLE public.shifts ADD CONSTRAINT shifts_staff_profile_fk FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD CONSTRAINT appts_patient_profile_fk FOREIGN KEY (patient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD CONSTRAINT appts_doctor_profile_fk FOREIGN KEY (doctor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.requests ADD CONSTRAINT requests_staff_profile_fk FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_profile_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
