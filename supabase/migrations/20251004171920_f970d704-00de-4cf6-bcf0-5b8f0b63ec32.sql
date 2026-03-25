-- Create property_types table with filter metadata
CREATE TABLE IF NOT EXISTS public.property_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  filter_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_types ENABLE ROW LEVEL SECURITY;

-- Allow public read access to property types (no authentication required)
CREATE POLICY "Property types are viewable by everyone"
ON public.property_types
FOR SELECT
USING (true);

-- Insert property types with comprehensive filter metadata
INSERT INTO public.property_types (name, slug, filter_metadata) VALUES
('Căn hộ chung cư', 'can-ho-chung-cu', '{
  "FOR_SALE": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "legalStatus", "projectName"],
  "FOR_RENT": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "serviceCosts", "expectedMoveInDate"]
}'::jsonb),
('Chung cư mini, căn hộ dịch vụ', 'chung-cu-mini-chdv', '{
  "FOR_SALE": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "legalStatus"],
  "FOR_RENT": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "serviceCosts", "expectedMoveInDate"]
}'::jsonb),
('Các loại nhà', 'cac-loai-nha', '{
  "FOR_SALE": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"],
  "FOR_RENT": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"]
}'::jsonb),
('Các loại đất', 'cac-loai-dat', '{
  "FOR_SALE": ["landType", "facadeWidth", "depth", "legalStatus", "planningInfo", "landDirection", "projectName"],
  "FOR_RENT": []
}'::jsonb),
('Trang trại, khu nghỉ dưỡng', 'trang-trai-khu-nghi-duong', '{
  "FOR_SALE": ["landArea", "existingStructures", "infrastructure", "legalStatus", "accessRoadWidth", "landDirection"],
  "FOR_RENT": ["landArea", "existingStructures", "infrastructure", "accessRoadWidth", "expectedMoveInDate"]
}'::jsonb),
('Kho, nhà xưởng', 'kho-nha-xuong', '{
  "FOR_SALE": ["ceilingHeight", "floorLoad", "fireProtection", "transportAccess", "legalStatus", "facadeWidth", "alleyWidth"],
  "FOR_RENT": ["ceilingHeight", "floorLoad", "fireProtection", "transportAccess", "facadeWidth", "alleyWidth", "expectedMoveInDate"]
}'::jsonb),
('BĐS khác', 'bds-khac', '{
  "FOR_SALE": ["customAttributes"],
  "FOR_RENT": ["customAttributes"]
}'::jsonb),
('Condotel', 'condotel', '{
  "FOR_SALE": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "legalStatus", "projectName"],
  "FOR_RENT": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "serviceCosts", "expectedMoveInDate"]
}'::jsonb),
('Văn phòng', 'van-phong', '{
  "FOR_SALE": [],
  "FOR_RENT": ["area", "floorNumber", "interiorStatus", "serviceCosts", "expectedMoveInDate"]
}'::jsonb),
('Cửa hàng, Kiot', 'cua-hang-kiot', '{
  "FOR_SALE": [],
  "FOR_RENT": ["area", "facadeWidth", "alleyWidth", "interiorStatus", "serviceCosts", "expectedMoveInDate"]
}'::jsonb),
('Nhà trọ, phòng trọ', 'nha-tro-phong-tro', '{
  "FOR_SALE": [],
  "FOR_RENT": ["numBedrooms", "interiorStatus", "serviceCosts", "expectedMoveInDate"]
}'::jsonb);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_property_types_updated_at
BEFORE UPDATE ON public.property_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();