-- Drop the problematic policies first
DROP POLICY IF EXISTS "Members can view organization memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Org members can view member profiles" ON profiles;

-- Create a helper function to get user email without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM profiles WHERE id = _user_id
$$;

-- Recreate the organization_memberships policy without the profiles subquery
CREATE POLICY "Members can view organization memberships"
ON organization_memberships
FOR SELECT
TO authenticated
USING (
  is_org_member(auth.uid(), organization_id) 
  OR user_id = auth.uid() 
  OR (user_id IS NULL AND invite_email = get_user_email(auth.uid()))
);

-- Create a simpler profiles policy that doesn't query organization_memberships
CREATE POLICY "Users can view own and org member profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);