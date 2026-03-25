
DROP POLICY "Authenticated users can view active listings" ON public.listings;

CREATE POLICY "Anyone can view active and completed listings"
ON public.listings FOR SELECT
USING (
  status IN ('ACTIVE', 'SOLD_RENTED')
  OR auth.uid() = user_id
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);
