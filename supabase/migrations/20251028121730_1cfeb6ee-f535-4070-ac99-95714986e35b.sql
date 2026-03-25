-- Step 3: Create organization_memberships table
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.organization_roles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'PENDING_INVITE' CHECK (status IN ('PENDING_INVITE', 'ACTIVE', 'INACTIVE')),
  invited_by UUID REFERENCES auth.users(id),
  invite_token TEXT UNIQUE,
  invite_email TEXT,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_token ON public.organization_memberships(invite_token);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.organization_memberships(status);

-- Add column to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_listings_organization ON public.listings(organization_id);

-- Create trigger
DROP TRIGGER IF EXISTS update_organization_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER update_organization_memberships_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create Owner membership
CREATE OR REPLACE FUNCTION public.create_owner_membership()
RETURNS TRIGGER AS $$
DECLARE
  owner_role_id UUID;
BEGIN
  SELECT id INTO owner_role_id FROM public.organization_roles WHERE name = 'Owner';
  
  INSERT INTO public.organization_memberships (user_id, organization_id, role_id, status, joined_at)
  VALUES (NEW.owner_id, NEW.id, owner_role_id, 'ACTIVE', NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS create_owner_membership_trigger ON public.organizations;
CREATE TRIGGER create_owner_membership_trigger
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_owner_membership();

-- Enable RLS
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Members can view organization memberships" ON public.organization_memberships;
CREATE POLICY "Members can view organization memberships"
  ON public.organization_memberships FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid() AND status = 'ACTIVE')
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Owners and managers can invite members" ON public.organization_memberships;
CREATE POLICY "Owners and managers can invite members"
  ON public.organization_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      JOIN public.organization_roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_memberships.organization_id
        AND om.status = 'ACTIVE'
        AND (r.name = 'Owner' OR (r.name = 'Manager' AND organization_memberships.role_id IN (SELECT id FROM public.organization_roles WHERE name = 'Agent')))
    )
  );

DROP POLICY IF EXISTS "Users can accept or decline invitations" ON public.organization_memberships;
CREATE POLICY "Users can accept or decline invitations"
  ON public.organization_memberships FOR UPDATE
  USING (user_id = auth.uid() AND status = 'PENDING_INVITE');

DROP POLICY IF EXISTS "Owners can remove members" ON public.organization_memberships;
CREATE POLICY "Owners can remove members"
  ON public.organization_memberships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      JOIN public.organization_roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_memberships.organization_id
        AND om.status = 'ACTIVE'
        AND r.name = 'Owner'
    )
    AND user_id != auth.uid()
  );

DROP POLICY IF EXISTS "Managers can remove agents" ON public.organization_memberships;
CREATE POLICY "Managers can remove agents"
  ON public.organization_memberships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      JOIN public.organization_roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_memberships.organization_id
        AND om.status = 'ACTIVE'
        AND r.name = 'Manager'
        AND organization_memberships.role_id IN (SELECT id FROM public.organization_roles WHERE name = 'Agent')
    )
  );

DROP POLICY IF EXISTS "Admins can manage all memberships" ON public.organization_memberships;
CREATE POLICY "Admins can manage all memberships"
  ON public.organization_memberships FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Update listings policies for organizations
DROP POLICY IF EXISTS "Organization owners and managers can update org listings" ON public.listings;
CREATE POLICY "Organization owners and managers can update org listings"
  ON public.listings FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships om
      JOIN public.organization_roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND om.organization_id = listings.organization_id
        AND om.status = 'ACTIVE'
        AND r.name IN ('Owner', 'Manager')
    )
  );

DROP POLICY IF EXISTS "Organization owners and managers can delete org listings" ON public.listings;
CREATE POLICY "Organization owners and managers can delete org listings"
  ON public.listings FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships om
      JOIN public.organization_roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND om.organization_id = listings.organization_id
        AND om.status = 'ACTIVE'
        AND r.name IN ('Owner', 'Manager')
    )
  );

-- Update organizations RLS to include membership check
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT organization_id FROM public.organization_memberships WHERE user_id = auth.uid() AND status = 'ACTIVE')
  );