-- Add RLS policy to allow admins to update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));