-- Step 2: Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kyc_status kyc_status NOT NULL DEFAULT 'NOT_APPLIED',
  license_info JSONB DEFAULT '{}',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_kyc_status ON public.organizations(kyc_status);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Approved users can create organizations" ON public.organizations;
CREATE POLICY "Approved users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id 
    AND kyc_status = 'PENDING_KYC'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND kyc_status = 'APPROVED'
    )
  );

DROP POLICY IF EXISTS "Owners can update their organizations" ON public.organizations;
CREATE POLICY "Owners can update their organizations"
  ON public.organizations FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Admins can manage all organizations" ON public.organizations;
CREATE POLICY "Admins can manage all organizations"
  ON public.organizations FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));