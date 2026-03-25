-- Drop existing policy that blocks new user signup with invite
DROP POLICY IF EXISTS "Users can accept or decline invitations" ON organization_memberships;

-- Create new policy that allows both existing members and new signups with invite token
CREATE POLICY "Users can claim invites and accept invitations"
ON organization_memberships
FOR UPDATE
USING (
  -- User can accept their existing pending invitation
  (user_id = auth.uid() AND status = 'PENDING_INVITE')
  OR
  -- User can claim an invite with token (for new signups)
  (user_id IS NULL AND invite_token IS NOT NULL)
)
WITH CHECK (
  -- After update, user_id must be the authenticated user
  user_id = auth.uid()
);