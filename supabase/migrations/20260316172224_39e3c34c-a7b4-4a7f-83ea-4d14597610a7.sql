UPDATE listings 
SET custom_attributes = jsonb_set(
  COALESCE(custom_attributes, '{}'::jsonb), 
  '{session_status}', 
  '"ongoing"'
)
WHERE id = 'cacf14e7-dfd8-4882-b359-f67a88919eaa';