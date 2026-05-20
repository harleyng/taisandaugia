-- Ensure the three default roles exist so the create_owner_membership trigger
-- can look up the Owner role_id on every organizations INSERT.
INSERT INTO public.organization_roles (name, permissions, description)
VALUES
  ('Owner',   '["ALL_PERMISSIONS"]',                                                                                              'Full control over organization'),
  ('Manager', '["CAN_POST_LISTING","CAN_INVITE_AGENT","CAN_REMOVE_AGENT","CAN_MANAGE_LISTINGS","CAN_VIEW_ANALYTICS"]',           'Can manage listings and agents'),
  ('Agent',   '["CAN_POST_LISTING","CAN_VIEW_OWN_LISTINGS"]',                                                                    'Can only post and manage own listings')
ON CONFLICT (name) DO NOTHING;
