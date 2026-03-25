-- Update existing property types with comprehensive filter metadata

-- Căn hộ chung cư
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "legalStatus", "projectName"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "serviceCosts", "expectedMoveInDate"] 
  }
}'::jsonb
WHERE slug = 'can-ho-chung-cu';

-- Chung cư mini, căn hộ dịch vụ
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "legalStatus"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "serviceCosts", "expectedMoveInDate"] 
  }
}'::jsonb
WHERE slug = 'chung-cu-mini-chdv';

-- Nhà riêng
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"] 
  }
}'::jsonb
WHERE slug = 'nha-rieng';

-- Biệt thự
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"] 
  }
}'::jsonb
WHERE slug = 'biet-thu';

-- Nhà mặt phố
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"] 
  }
}'::jsonb
WHERE slug = 'nha-mat-pho';

-- Shophouse
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"] 
  }
}'::jsonb
WHERE slug = 'shophouse';

-- Đất nền dự án
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["landType", "facadeWidth", "depth", "legalStatus", "planningInfo", "landDirection", "projectName"] 
  },
  "FOR_RENT": { 
    "available": false, 
    "filters": [] 
  }
}'::jsonb
WHERE slug = 'dat-nen-du-an';

-- Đất thổ cư
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["landType", "facadeWidth", "depth", "legalStatus", "planningInfo", "landDirection", "projectName"] 
  },
  "FOR_RENT": { 
    "available": false, 
    "filters": [] 
  }
}'::jsonb
WHERE slug = 'dat-tho-cu';

-- Trang trại, khu nghỉ dưỡng
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["landArea", "existingStructures", "infrastructure", "legalStatus", "accessRoadWidth", "landDirection"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["landArea", "existingStructures", "infrastructure", "accessRoadWidth", "expectedMoveInDate"] 
  }
}'::jsonb
WHERE slug = 'trang-trai-khu-nghi-duong';

-- Kho, nhà xưởng
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["ceilingHeight", "floorLoad", "fireProtection", "transportAccess", "facadeWidth", "alleyWidth", "legalStatus"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["ceilingHeight", "floorLoad", "fireProtection", "transportAccess", "facadeWidth", "alleyWidth", "expectedMoveInDate"] 
  }
}'::jsonb
WHERE slug = 'kho-nha-xuong';

-- BĐS khác
UPDATE property_types 
SET filter_metadata = '{
  "FOR_SALE": { 
    "available": true, 
    "filters": ["customAttributes"] 
  },
  "FOR_RENT": { 
    "available": true, 
    "filters": ["customAttributes"] 
  }
}'::jsonb
WHERE slug = 'bds-khac';

-- Add new property types

-- Condotel
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Condotel',
  'condotel',
  '{
    "FOR_SALE": { 
      "available": true, 
      "filters": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "legalStatus", "projectName"] 
    },
    "FOR_RENT": { 
      "available": true, 
      "filters": ["numBedrooms", "numBathrooms", "floorNumber", "balconyDirection", "interiorStatus", "serviceCosts", "expectedMoveInDate"] 
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE 
SET filter_metadata = EXCLUDED.filter_metadata;

-- Văn phòng
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Văn phòng',
  'van-phong',
  '{
    "FOR_SALE": { 
      "available": true, 
      "filters": ["area", "floorNumber", "interiorStatus", "legalStatus"] 
    },
    "FOR_RENT": { 
      "available": true, 
      "filters": ["area", "floorNumber", "interiorStatus", "serviceCosts", "expectedMoveInDate"] 
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE 
SET filter_metadata = EXCLUDED.filter_metadata;

-- Cửa hàng, Kiot
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Cửa hàng, Kiot',
  'cua-hang-kiot',
  '{
    "FOR_SALE": { 
      "available": true, 
      "filters": ["area", "facadeWidth", "alleyWidth", "legalStatus"] 
    },
    "FOR_RENT": { 
      "available": true, 
      "filters": ["area", "facadeWidth", "alleyWidth", "interiorStatus", "serviceCosts", "expectedMoveInDate"] 
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE 
SET filter_metadata = EXCLUDED.filter_metadata;

-- Nhà trọ, phòng trọ
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Nhà trọ, phòng trọ',
  'nha-tro-phong-tro',
  '{
    "FOR_SALE": { 
      "available": false, 
      "filters": [] 
    },
    "FOR_RENT": { 
      "available": true, 
      "filters": ["numBedrooms", "interiorStatus", "serviceCosts", "expectedMoveInDate"] 
    }
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE 
SET filter_metadata = EXCLUDED.filter_metadata;