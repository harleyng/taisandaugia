-- Drop policies that depend on the functions
DROP POLICY IF EXISTS "Members can view organization memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and managers can invite members" ON organization_memberships;
DROP POLICY IF EXISTS "Owners can remove members" ON organization_memberships;
DROP POLICY IF EXISTS "Managers can remove agents" ON organization_memberships;

-- Drop problematic profile policies
DROP POLICY IF EXISTS "Organization members can view each other's profiles" ON profiles;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, text[]) CASCADE;

-- Recreate security definer functions
CREATE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE user_id = _user_id
    AND organization_id = _org_id
    AND status = 'ACTIVE'
  )
$$;

CREATE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role_names text[])
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
    AND om.organization_id = _org_id
    AND om.status = 'ACTIVE'
    AND r.name = ANY(_role_names)
  )
$$;

-- Recreate organization_memberships policies using the security definer functions
CREATE POLICY "Members can view organization memberships"
ON organization_memberships
FOR SELECT
TO authenticated
USING (
  is_org_member(auth.uid(), organization_id) 
  OR user_id = auth.uid() 
  OR (user_id IS NULL AND invite_email = (SELECT email FROM profiles WHERE id = auth.uid()))
);

CREATE POLICY "Owners and managers can invite members"
ON organization_memberships
FOR INSERT
TO authenticated
WITH CHECK (has_org_role(auth.uid(), organization_id, ARRAY['Owner', 'Manager']));

CREATE POLICY "Owners can remove members"
ON organization_memberships
FOR DELETE
TO authenticated
USING (
  has_org_role(auth.uid(), organization_id, ARRAY['Owner']) 
  AND user_id != auth.uid()
);

CREATE POLICY "Managers can remove agents"
ON organization_memberships
FOR DELETE
TO authenticated
USING (
  has_org_role(auth.uid(), organization_id, ARRAY['Manager']) 
  AND role_id IN (SELECT id FROM organization_roles WHERE name = 'Agent')
);

-- Add profile policy for org members to view each other
CREATE POLICY "Org members can view member profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR id IN (
    SELECT DISTINCT om.user_id
    FROM organization_memberships om
    WHERE om.organization_id IN (
      SELECT organization_id
      FROM organization_memberships
      WHERE user_id = auth.uid()
      AND status = 'ACTIVE'
    )
    AND om.status = 'ACTIVE'
    AND om.user_id IS NOT NULL
  )
);