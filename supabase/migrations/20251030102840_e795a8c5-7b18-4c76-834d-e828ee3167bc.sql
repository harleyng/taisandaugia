-- Fix the SELECT policy to query from profiles table instead of auth.users
DROP POLICY IF EXISTS "Members can view organization memberships" ON organization_memberships;

CREATE POLICY "Members can view organization memberships"
ON organization_memberships
FOR SELECT
USING (
  is_org_member(auth.uid(), organization_id) 
  OR (user_id = auth.uid())
  OR (user_id IS NULL AND invite_email = (SELECT email FROM profiles WHERE id = auth.uid()))
);