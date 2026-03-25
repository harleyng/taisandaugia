-- Add new address fields to listings table for apartment/floor and building information
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS apartment_floor_info TEXT,
ADD COLUMN IF NOT EXISTS building_name TEXT;

COMMENT ON COLUMN public.listings.apartment_floor_info IS 'Căn hộ, tầng, v.v. (optional)';
COMMENT ON COLUMN public.listings.building_name IS 'Tên toà nhà, v.v. (optional)';