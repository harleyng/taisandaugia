-- Drop the current overly permissive policy that allows anyone (including unauthenticated users) to view active listings
DROP POLICY IF EXISTS "Everyone can view active listings" ON public.listings;

-- Create a new policy that requires authentication to view active listings
-- This protects contact_info from being scraped by unauthenticated users
CREATE POLICY "Authenticated users can view active listings"
ON public.listings
FOR SELECT
TO authenticated
USING (
  (status = 'ACTIVE'::listing_status) 
  OR (auth.uid() = user_id) 
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Users can still view their own listings regardless of status
-- Admins can view all listings
-- But now, contact_info is protected from public scraping