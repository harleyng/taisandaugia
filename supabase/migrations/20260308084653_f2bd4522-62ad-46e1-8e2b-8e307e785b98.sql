UPDATE public.listings 
SET custom_attributes = custom_attributes || '{"step_price": 50000000, "deposit_amount": 300000000}'::jsonb
WHERE status = 'SOLD_RENTED' AND custom_attributes->>'step_price' IS NULL;