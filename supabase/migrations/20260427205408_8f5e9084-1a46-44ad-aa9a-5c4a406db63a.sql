
-- Create trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users without one
INSERT INTO public.profiles (id, email, name, kyc_status)
SELECT u.id, COALESCE(u.email, ''), u.raw_user_meta_data->>'name', 'NOT_APPLIED'::kyc_status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Backfill default USER role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'USER'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'USER'
WHERE r.id IS NULL;
