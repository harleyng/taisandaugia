-- Drop the deprecated contact_info column from listings table
-- This column has been replaced by the listing_contacts table for better security
ALTER TABLE public.listings DROP COLUMN IF EXISTS contact_info;