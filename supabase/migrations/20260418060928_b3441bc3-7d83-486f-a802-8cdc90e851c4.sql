UPDATE listings
SET custom_attributes = COALESCE(custom_attributes, '{}'::jsonb) || jsonb_build_object(
  'winning_price', ROUND(price * 1.18)::bigint,
  'auction_status', 'COMPLETED',
  'winning_date', '2025-11-20'
)
WHERE id = '7d3538a4-33c4-4577-89d4-bc50bc204d73';

UPDATE listings
SET custom_attributes = COALESCE(custom_attributes, '{}'::jsonb) || jsonb_build_object(
  'winning_price', ROUND(price * 1.05)::bigint,
  'auction_status', 'COMPLETED',
  'winning_date', '2025-12-02'
)
WHERE id = 'b92573c8-7db5-4f50-ab33-ef9e3fecf65b';

UPDATE listings
SET custom_attributes = COALESCE(custom_attributes, '{}'::jsonb) || jsonb_build_object(
  'winning_price', ROUND(price * 1.32)::bigint,
  'auction_status', 'COMPLETED',
  'winning_date', '2026-01-15'
)
WHERE id = '7159f3e8-30e0-458e-b401-ecc9ab21d534';

UPDATE listings
SET custom_attributes = COALESCE(custom_attributes, '{}'::jsonb) || jsonb_build_object(
  'winning_price', ROUND(price * 1.12)::bigint,
  'auction_status', 'COMPLETED',
  'winning_date', '2026-02-08'
)
WHERE id = 'a9d70318-d6f0-499b-859d-e7b9e9e09bf2';

UPDATE listings
SET custom_attributes = COALESCE(custom_attributes, '{}'::jsonb) || jsonb_build_object(
  'winning_price', ROUND(price * 1.21)::bigint,
  'auction_status', 'COMPLETED',
  'winning_date', '2026-03-01'
)
WHERE id = '4ab0d908-527c-4f79-81c7-b04fa6809265';