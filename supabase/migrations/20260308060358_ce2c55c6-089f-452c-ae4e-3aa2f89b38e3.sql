
-- Drop the restrictive policy
DROP POLICY "Anyone can view active and completed listings" ON public.listings;

-- Recreate as PERMISSIVE policy so anonymous/public users can read active and completed listings
CREATE POLICY "Anyone can view active and completed listings"
ON public.listings FOR SELECT
TO public
USING (
  status IN ('ACTIVE', 'SOLD_RENTED')
  OR auth.uid() = user_id
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);
