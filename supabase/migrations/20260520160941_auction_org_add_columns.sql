-- NOTE: This migration had invalid UUID values ('cty-001' etc.) in the INSERT.
-- The INSERT has been removed; it is replaced by migration 20260520210252_fix_auction_org_seed.sql
-- which uses proper UUID values.

ALTER TABLE auction_organizations
  ADD COLUMN IF NOT EXISTS tax_code TEXT,
  ADD COLUMN IF NOT EXISTS province  TEXT;
