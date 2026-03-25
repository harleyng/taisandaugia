-- Step 1: Create organization_roles table first (no dependencies)
CREATE TABLE IF NOT EXISTS public.organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (name IN ('Owner', 'Manager', 'Agent')),
  permissions JSONB NOT NULL DEFAULT '[]',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default roles
INSERT INTO public.organization_roles (name, permissions, description) 
VALUES
  ('Owner', '["ALL_PERMISSIONS"]', 'Full control over organization'),
  ('Manager', '["CAN_POST_LISTING", "CAN_INVITE_AGENT", "CAN_REMOVE_AGENT", "CAN_MANAGE_LISTINGS", "CAN_VIEW_ANALYTICS"]', 'Can manage listings and agents'),
  ('Agent', '["CAN_POST_LISTING", "CAN_VIEW_OWN_LISTINGS"]', 'Can only post and manage own listings')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view roles
DROP POLICY IF EXISTS "Anyone can view roles" ON public.organization_roles;
CREATE POLICY "Anyone can view roles"
  ON public.organization_roles FOR SELECT
  USING (true);