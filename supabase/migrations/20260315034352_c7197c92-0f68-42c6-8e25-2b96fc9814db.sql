CREATE OR REPLACE FUNCTION public.check_email_exists(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE email = _email
  )
$$;