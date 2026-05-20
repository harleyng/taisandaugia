-- Fix organizations INSERT RLS: remove the contradictory requirement that
-- the inserting user's profile must already have kyc_status = 'APPROVED'.
-- Any authenticated user can now submit a PENDING_KYC organization for themselves.

DROP POLICY IF EXISTS "organization_insert" ON public.organizations;

CREATE POLICY "organization_insert" ON public.organizations
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id AND kyc_status = 'PENDING_KYC'
  );
