-- Fix RLS SELECT/UPDATE policies for partnership_registrations and contact_submissions
-- Use has_role() SECURITY DEFINER function (consistent with rest of codebase)

-- partnership_registrations: admin-only SELECT
DROP POLICY IF EXISTS "service role can select" ON public.partnership_registrations;
DROP POLICY IF EXISTS "admins can select" ON public.partnership_registrations;
CREATE POLICY "admins can select"
  ON public.partnership_registrations
  FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- partnership_registrations: admin-only UPDATE
DROP POLICY IF EXISTS "service role can update" ON public.partnership_registrations;
DROP POLICY IF EXISTS "admins can update" ON public.partnership_registrations;
CREATE POLICY "admins can update"
  ON public.partnership_registrations
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- contact_submissions: fix SELECT to use has_role instead of raw EXISTS on user_roles
DROP POLICY IF EXISTS "Admins can view" ON public.contact_submissions;
CREATE POLICY "Admins can view"
  ON public.contact_submissions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- contact_submissions: fix UPDATE to use has_role
DROP POLICY IF EXISTS "Admins can update" ON public.contact_submissions;
CREATE POLICY "Admins can update"
  ON public.contact_submissions
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
