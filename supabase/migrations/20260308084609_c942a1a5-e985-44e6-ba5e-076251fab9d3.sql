UPDATE public.listings 
SET custom_attributes = custom_attributes || '{"registration_deadline": "2026-03-13T17:00:00Z"}'::jsonb
WHERE status = 'ACTIVE' AND id = (SELECT id FROM public.listings WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1);

UPDATE public.listings 
SET custom_attributes = custom_attributes || '{"registration_deadline": "2026-03-16T17:00:00Z"}'::jsonb
WHERE status = 'ACTIVE' AND id != (SELECT id FROM public.listings WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1);