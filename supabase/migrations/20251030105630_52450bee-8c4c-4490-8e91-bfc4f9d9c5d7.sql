-- Allow organization members to view profiles of other members in the same organization
CREATE POLICY "Organization members can view each other's profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  id IN (
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