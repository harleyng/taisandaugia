-- Fix: asset_owner_org_kyc must have at most 1 row per user.
-- 1. Keep the best record per created_by (prefer highest-priority status, then latest created_at)
-- 2. Add UNIQUE constraint on created_by

DELETE FROM public.asset_owner_org_kyc
WHERE id NOT IN (
  SELECT DISTINCT ON (created_by) id
  FROM public.asset_owner_org_kyc
  ORDER BY
    created_by,
    CASE status
      WHEN 'approved'        THEN 0
      WHEN 'under_review'    THEN 1
      WHEN 'pending_review'  THEN 2
      WHEN 'draft'           THEN 3
      WHEN 'rejected'        THEN 4
      ELSE 5
    END ASC,
    created_at DESC
);

ALTER TABLE public.asset_owner_org_kyc
  ADD CONSTRAINT asset_owner_org_kyc_created_by_unique UNIQUE (created_by);
