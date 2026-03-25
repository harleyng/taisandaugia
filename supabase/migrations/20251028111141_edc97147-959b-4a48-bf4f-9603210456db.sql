-- Remove is_agent column as all users are now potential agents
ALTER TABLE profiles DROP COLUMN IF EXISTS is_agent;

-- Ensure kyc_status has proper default
ALTER TABLE profiles ALTER COLUMN kyc_status SET DEFAULT 'NOT_APPLIED'::kyc_status;

-- Update the handle_new_user trigger function to only set kyc_status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, kyc_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    'NOT_APPLIED'::kyc_status
  );
  
  -- Assign default USER role (no BROKER role needed)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'USER');
  
  RETURN NEW;
END;
$function$;