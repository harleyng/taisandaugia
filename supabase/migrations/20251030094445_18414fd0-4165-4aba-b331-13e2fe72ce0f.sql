-- Create security definer function to check if user is org member
CREATE OR REPLACE FUNCTION public.is_org_member(
  _user_id uuid,
  _organization_id uuid
)
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
      AND organization_id = _organization_id
      AND status = 'ACTIVE'
  )
$$;

-- Drop and recreate the problematic SELECT policy
DROP POLICY IF EXISTS "Members can view organization memberships" ON organization_memberships;

CREATE POLICY "Members can view organization memberships"
ON organization_memberships
FOR SELECT
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR user_id = auth.uid()
);