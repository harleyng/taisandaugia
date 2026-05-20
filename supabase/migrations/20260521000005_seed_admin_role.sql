-- Assign ADMIN role to the platform admin account
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'ADMIN'::app_role
FROM auth.users
WHERE email = 'harleyngx@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
