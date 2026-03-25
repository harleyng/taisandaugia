-- Create a separate table for protected contact information
CREATE TABLE public.listing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  contact_info jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.listing_contacts ENABLE ROW LEVEL SECURITY;

-- Only listing owners can view their own contact info
CREATE POLICY "Users can view their own listing contacts"
ON public.listing_contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = listing_contacts.listing_id
    AND listings.user_id = auth.uid()
  )
);

-- Admins can view all contact info
CREATE POLICY "Admins can view all listing contacts"
ON public.listing_contacts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Users can insert contact info for their own listings
CREATE POLICY "Users can insert contacts for their own listings"
ON public.listing_contacts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = listing_contacts.listing_id
    AND listings.user_id = auth.uid()
  )
);

-- Users can update their own listing contacts
CREATE POLICY "Users can update their own listing contacts"
ON public.listing_contacts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = listing_contacts.listing_id
    AND listings.user_id = auth.uid()
  )
);

-- Users can delete their own listing contacts
CREATE POLICY "Users can delete their own listing contacts"
ON public.listing_contacts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = listing_contacts.listing_id
    AND listings.user_id = auth.uid()
  )
);

-- Admins can manage all contacts
CREATE POLICY "Admins can manage all listing contacts"
ON public.listing_contacts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_listing_contacts_updated_at
BEFORE UPDATE ON public.listing_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing contact_info data to the new table
INSERT INTO public.listing_contacts (listing_id, contact_info)
SELECT id, contact_info
FROM public.listings
WHERE contact_info IS NOT NULL;

-- Note: We're keeping the contact_info column in listings for backward compatibility
-- but it should no longer be used. Applications should migrate to use listing_contacts table.