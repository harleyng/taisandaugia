-- Create listings table for real estate properties
CREATE TABLE public.listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('FOR_SALE', 'FOR_RENT')),
  property_type_slug TEXT NOT NULL,
  price DECIMAL(15, 2) NOT NULL,
  area DECIMAL(10, 2) NOT NULL,
  district TEXT NOT NULL,
  address TEXT,
  image_url TEXT,
  
  -- Common attributes
  num_bedrooms INTEGER,
  num_bathrooms INTEGER,
  num_floors INTEGER,
  floor_number INTEGER,
  
  -- Direction fields
  house_direction TEXT,
  balcony_direction TEXT,
  land_direction TEXT,
  
  -- Dimension fields
  facade_width DECIMAL(10, 2),
  depth DECIMAL(10, 2),
  alley_width DECIMAL(10, 2),
  
  -- Legal and status
  legal_status TEXT,
  interior_status TEXT,
  
  -- Commercial properties
  ceiling_height DECIMAL(10, 2),
  floor_load DECIMAL(10, 2),
  fire_protection BOOLEAN,
  transport_access TEXT,
  
  -- Land properties
  land_type TEXT,
  planning_info TEXT,
  existing_structures TEXT,
  infrastructure TEXT,
  access_road_width DECIMAL(10, 2),
  
  -- Project info
  project_name TEXT,
  
  -- Rental specific
  service_costs DECIMAL(15, 2),
  expected_move_in_date DATE,
  
  -- Custom attributes (for flexible data)
  custom_attributes JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  featured BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Create policy for public viewing
CREATE POLICY "Listings are viewable by everyone" 
ON public.listings 
FOR SELECT 
USING (true);

-- Create index for common queries
CREATE INDEX idx_listings_purpose ON public.listings(purpose);
CREATE INDEX idx_listings_property_type ON public.listings(property_type_slug);
CREATE INDEX idx_listings_district ON public.listings(district);
CREATE INDEX idx_listings_price ON public.listings(price);
CREATE INDEX idx_listings_area ON public.listings(area);
CREATE INDEX idx_listings_created_at ON public.listings(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_listings_updated_at
BEFORE UPDATE ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();