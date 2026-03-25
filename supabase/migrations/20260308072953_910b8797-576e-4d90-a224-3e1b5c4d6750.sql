
-- Drop the current RESTRICTIVE select policy
DROP POLICY IF EXISTS "Anyone can view active and completed listings" ON public.listings;

-- Create a PERMISSIVE select policy for public access to active/completed listings
CREATE POLICY "Public can view active and completed listings"
ON public.listings
AS PERMISSIVE
FOR SELECT
TO public
USING (status IN ('ACTIVE', 'SOLD_RENTED'));

-- Keep a separate permissive policy for owners and admins to see their own listings
CREATE POLICY "Users can view own listings"
ON public.listings
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'ADMIN'::app_role));
