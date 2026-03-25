-- Create helper function to check if two users share an organization
CREATE OR REPLACE FUNCTION public.users_share_org(_user1_id uuid, _user2_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_memberships om1
    JOIN organization_memberships om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = _user1_id
    AND om2.user_id = _user2_id
    AND om1.status = 'ACTIVE'
    AND om2.status = 'ACTIVE'
  )
$$;

-- Add policy for viewing org member profiles using the helper function
CREATE POLICY "Users can view org member profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR users_share_org(auth.uid(), id)
);