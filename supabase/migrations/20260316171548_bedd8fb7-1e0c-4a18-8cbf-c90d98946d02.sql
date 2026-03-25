UPDATE listings 
SET custom_attributes = jsonb_set(
  COALESCE(custom_attributes, '{}'::jsonb), 
  '{auction_date}', 
  to_jsonb(to_char(now() - interval '30 minutes', 'YYYY-MM-DD"T"HH24:MI:SS'))
)
WHERE id = 'cacf14e7-dfd8-4882-b359-f67a88919eaa';