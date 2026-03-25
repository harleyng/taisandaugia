-- Add missing foreign key constraints between organization_memberships and profiles
-- (profiles.id is already a primary key, so we just add the foreign keys)

-- Add foreign key from organization_memberships.user_id to profiles.id
ALTER TABLE organization_memberships
DROP CONSTRAINT IF EXISTS organization_memberships_user_id_fkey;

ALTER TABLE organization_memberships
ADD CONSTRAINT organization_memberships_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add foreign key from organization_memberships.invited_by to profiles.id
ALTER TABLE organization_memberships
DROP CONSTRAINT IF EXISTS organization_memberships_invited_by_fkey;

ALTER TABLE organization_memberships
ADD CONSTRAINT organization_memberships_invited_by_fkey
FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add foreign key from organizations.owner_id to profiles.id
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_owner_id_fkey;

ALTER TABLE organizations
ADD CONSTRAINT organizations_owner_id_fkey
FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;