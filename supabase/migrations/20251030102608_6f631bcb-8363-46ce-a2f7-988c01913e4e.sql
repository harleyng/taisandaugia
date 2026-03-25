-- Update the SELECT policy to allow users to view invites sent to their email
DROP POLICY IF EXISTS "Members can view organization memberships" ON organization_memberships;

CREATE POLICY "Members can view organization memberships"
ON organization_memberships
FOR SELECT
USING (
  is_org_member(auth.uid(), organization_id) 
  OR (user_id = auth.uid())
  OR (user_id IS NULL AND invite_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);