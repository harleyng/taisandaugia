-- Delete broad category types
DELETE FROM property_types WHERE slug IN ('cac-loai-nha', 'cac-loai-dat');

-- Add Nhà riêng
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Nhà riêng',
  'nha-rieng',
  '{
    "FOR_SALE": {
      "available": true,
      "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"]
    },
    "FOR_RENT": {
      "available": true,
      "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"]
    }
  }'::jsonb
);

-- Add Nhà biệt thự
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Nhà biệt thự',
  'nha-biet-thu',
  '{
    "FOR_SALE": {
      "available": true,
      "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"]
    },
    "FOR_RENT": {
      "available": true,
      "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"]
    }
  }'::jsonb
);

-- Add Nhà liền kề
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Nhà liền kề',
  'nha-lien-ke',
  '{
    "FOR_SALE": {
      "available": true,
      "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"]
    },
    "FOR_RENT": {
      "available": true,
      "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"]
    }
  }'::jsonb
);

-- Add Nhà mặt phố
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Nhà mặt phố',
  'nha-mat-pho',
  '{
    "FOR_SALE": {
      "available": true,
      "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "legalStatus", "projectName"]
    },
    "FOR_RENT": {
      "available": true,
      "filters": ["numBedrooms", "numBathrooms", "numFloors", "houseDirection", "facadeWidth", "alleyWidth", "interiorStatus", "expectedMoveInDate"]
    }
  }'::jsonb
);

-- Add Shophouse
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Shophouse',
  'shophouse',
  '{
    "FOR_SALE": {
      "available": true,
      "filters": ["numFloors", "facadeWidth", "alleyWidth", "houseDirection", "legalStatus", "projectName"]
    },
    "FOR_RENT": {
      "available": true,
      "filters": ["numFloors", "facadeWidth", "alleyWidth", "houseDirection", "interiorStatus", "serviceCosts", "expectedMoveInDate"]
    }
  }'::jsonb
);

-- Add Đất nền dự án
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Đất nền dự án',
  'dat-nen-du-an',
  '{
    "FOR_SALE": {
      "available": true,
      "filters": ["landType", "facadeWidth", "depth", "legalStatus", "planningInfo", "landDirection", "projectName"]
    },
    "FOR_RENT": {
      "available": false,
      "filters": []
    }
  }'::jsonb
);

-- Add Đất thổ cư
INSERT INTO property_types (name, slug, filter_metadata)
VALUES (
  'Đất thổ cư',
  'dat-tho-cu',
  '{
    "FOR_SALE": {
      "available": true,
      "filters": ["landType", "facadeWidth", "depth", "legalStatus", "planningInfo", "landDirection", "projectName"]
    },
    "FOR_RENT": {
      "available": false,
      "filters": []
    }
  }'::jsonb
);

-- Update Kho, nhà xưởng name to include đất for consistency
UPDATE property_types 
SET name = 'Kho, nhà xưởng, đất'
WHERE slug = 'kho-nha-xuong';

-- Rename BĐS khác to Khác
UPDATE property_types 
SET name = 'Khác'
WHERE slug = 'bds-khac';