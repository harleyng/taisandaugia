
-- Create asset_owners table
CREATE TABLE public.asset_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view asset owners"
  ON public.asset_owners FOR SELECT TO public USING (true);

-- Add FK to listings
ALTER TABLE public.listings ADD COLUMN asset_owner_id uuid REFERENCES public.asset_owners(id);

-- Migrate data from custom_attributes
INSERT INTO public.asset_owners (name, address)
SELECT DISTINCT
  trim(custom_attributes->>'asset_owner_name'),
  trim(custom_attributes->>'asset_owner_address')
FROM public.listings
WHERE custom_attributes->>'asset_owner_name' IS NOT NULL
  AND trim(custom_attributes->>'asset_owner_name') != ''
ON CONFLICT (name) DO NOTHING;

-- Update listings with asset_owner_id
UPDATE public.listings l
SET asset_owner_id = ao.id
FROM public.asset_owners ao
WHERE trim(l.custom_attributes->>'asset_owner_name') = ao.name;
