ALTER TABLE public.auction_organizations ADD COLUMN IF NOT EXISTS org_type SMALLINT;
UPDATE public.auction_organizations SET org_type = 2 WHERE org_type IS NULL AND name ILIKE '%công ty%';
UPDATE public.auction_organizations SET org_type = 0 WHERE org_type IS NULL AND name ILIKE '%trung tâm%';
UPDATE public.auction_organizations SET org_type = 11 WHERE org_type IS NULL AND name ILIKE '%chi nhánh%';
UPDATE public.auction_organizations SET org_type = 1 WHERE org_type IS NULL AND name ILIKE '%doanh nghiệp%';