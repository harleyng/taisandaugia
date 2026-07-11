-- Email marketing: CTA is now authored INSIDE the email body (rich-text button node),
-- not as separate campaign-level fields. Drop the obsolete cta_label / cta_url columns.
ALTER TABLE public.marketing_campaigns
  DROP COLUMN IF EXISTS cta_label,
  DROP COLUMN IF EXISTS cta_url;
