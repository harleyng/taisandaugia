-- Create security definer function to check organization role
CREATE OR REPLACE FUNCTION public.has_org_role(
  _user_id uuid,
  _organization_id uuid,
  _role_names text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_memberships om
    JOIN organization_roles r ON om.role_id = r.id
    WHERE om.user_id = _user_id
      AND om.organization_id = _organization_id
      AND om.status = 'ACTIVE'
      AND r.name = ANY(_role_names)
  )
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Owners and managers can invite members" ON organization_memberships;
DROP POLICY IF EXISTS "Owners can remove members" ON organization_memberships;
DROP POLICY IF EXISTS "Managers can remove agents" ON organization_memberships;

-- Recreate policies using security definer function
CREATE POLICY "Owners and managers can invite members"
ON organization_memberships
FOR INSERT
WITH CHECK (
  public.has_org_role(auth.uid(), organization_id, ARRAY['Owner', 'Manager'])
);

CREATE POLICY "Owners can remove members"
ON organization_memberships
FOR DELETE
USING (
  public.has_org_role(auth.uid(), organization_id, ARRAY['Owner'])
  AND user_id != auth.uid()
);

CREATE POLICY "Managers can remove agents"
ON organization_memberships
FOR DELETE
USING (
  public.has_org_role(auth.uid(), organization_id, ARRAY['Manager'])
  AND role_id IN (
    SELECT id FROM organization_roles WHERE name = 'Agent'
  )
);