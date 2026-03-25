-- Drop old policies
DROP POLICY IF EXISTS "Owners can remove members" ON organization_memberships;
DROP POLICY IF EXISTS "Managers can remove agents" ON organization_memberships;

-- Recreate with fixed logic
CREATE POLICY "Owners can remove any member except themselves"
ON organization_memberships
FOR DELETE
TO authenticated
USING (
  has_org_role(auth.uid(), organization_id, ARRAY['Owner']) 
  AND (user_id IS NULL OR user_id != auth.uid())
);

CREATE POLICY "Managers can remove agents and pending invites"
ON organization_memberships
FOR DELETE
TO authenticated
USING (
  has_org_role(auth.uid(), organization_id, ARRAY['Manager']) 
  AND (
    user_id IS NULL 
    OR role_id IN (SELECT id FROM organization_roles WHERE name = 'Agent')
  )
  AND (user_id IS NULL OR user_id != auth.uid())
);