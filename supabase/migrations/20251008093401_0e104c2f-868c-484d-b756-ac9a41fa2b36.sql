-- Create enum for listing status
CREATE TYPE public.listing_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'SOLD_RENTED');

-- Create enum for price unit
CREATE TYPE public.price_unit AS ENUM ('TOTAL', 'PER_SQM', 'PER_MONTH');

-- Add new columns to listings table
ALTER TABLE public.listings
ADD COLUMN status listing_status NOT NULL DEFAULT 'PENDING_APPROVAL',
ADD COLUMN price_unit price_unit NOT NULL DEFAULT 'TOTAL',
ADD COLUMN coordinates jsonb,
ADD COLUMN contact_info jsonb,
ADD COLUMN prominent_features text[],
ADD COLUMN attributes jsonb;

-- Update address column to be jsonb (migrate existing data first)
-- First, migrate existing address text to jsonb format
UPDATE public.listings
SET custom_attributes = jsonb_build_object(
  'old_address', address,
  'old_district', district
)
WHERE address IS NOT NULL OR district IS NOT NULL;

-- Add new address_json column
ALTER TABLE public.listings
ADD COLUMN address_json jsonb;

-- Drop the old address and district text columns
-- (Keep them in custom_attributes for reference)
ALTER TABLE public.listings
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS district;

-- Rename address_json to address
ALTER TABLE public.listings
RENAME COLUMN address_json TO address;

-- Update RLS policies to allow users to create listings with DRAFT or PENDING_APPROVAL status
DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.listings;

CREATE POLICY "Authenticated users can create listings"
  ON public.listings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND status IN ('DRAFT', 'PENDING_APPROVAL')
  );

-- Add policy for admins to update listing status
CREATE POLICY "Admins can update listing status"
  ON public.listings
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- Update existing listings to have ACTIVE status
UPDATE public.listings
SET status = 'ACTIVE'
WHERE status = 'PENDING_APPROVAL';

-- Add index for status for better query performance
CREATE INDEX idx_listings_status ON public.listings(status);

-- Update the view listings policy to only show ACTIVE listings to non-owners
DROP POLICY IF EXISTS "Everyone can view listings" ON public.listings;

CREATE POLICY "Everyone can view active listings"
  ON public.listings
  FOR SELECT
  USING (
    status = 'ACTIVE' 
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'ADMIN')
  );