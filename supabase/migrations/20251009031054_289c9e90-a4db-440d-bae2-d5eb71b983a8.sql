-- Drop the overly permissive policy that allows anyone to view all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a restrictive policy: users can only view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Add admin policy to allow admins to view all profiles for management purposes
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'::app_role));