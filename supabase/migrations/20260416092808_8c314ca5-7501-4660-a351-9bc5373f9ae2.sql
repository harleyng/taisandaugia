
-- Create auction_organizations table
CREATE TABLE public.auction_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text,
  phone text,
  email text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view auction organizations"
  ON public.auction_organizations FOR SELECT TO public USING (true);

-- Add reference column to listings
ALTER TABLE public.listings ADD COLUMN auction_org_id uuid REFERENCES public.auction_organizations(id);

-- Migrate data from custom_attributes
INSERT INTO public.auction_organizations (name, address, phone, email)
SELECT DISTINCT
  ca->>'org_name',
  ca->>'org_address',
  ca->>'org_phone',
  ca->>'org_email'
FROM public.listings,
LATERAL (SELECT custom_attributes AS ca) sub
WHERE ca->>'org_name' IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Link listings to auction_organizations
UPDATE public.listings l
SET auction_org_id = ao.id
FROM public.auction_organizations ao
WHERE l.custom_attributes->>'org_name' = ao.name;
