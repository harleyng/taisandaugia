-- Ký gửi: đếm "việc đang chờ" cho badge điều hướng của cả hai bên
--
-- Tổ chức: org_service_request_counts thêm `contracts_action` — hợp đồng tổ
-- chức đang phải làm bước kế tiếp (soạn / ký / xác nhận).
-- Chủ tài sản: RPC mới owner_consignment_summary() — mỗi hồ sơ một dòng kèm
-- `owner_action` (confirm_contract | add_address | choose_quote).
--
-- Luật "ai đang phải làm" nhân bản ở TS: awaitingSides() trong
-- src/lib/consignment/contractState.ts (phía tổ chức) và postingBadge.ts (phía
-- chủ tài sản). Sửa một bên phải sửa bên kia.

-- ─── 1. Tổ chức ──────────────────────────────────────────────────────────────
-- RETURNS JSONB không đổi ⇒ CREATE OR REPLACE được. Giữ 'new'/'quoted' như cũ.

CREATE OR REPLACE FUNCTION public.org_service_request_counts(_auction_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.user_in_auction_org(_auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'new', (SELECT count(*) FROM public.asset_service_requests
             WHERE auction_org_id = _auction_org_id AND status = 'sent'),
    'quoted', (SELECT count(*) FROM public.asset_service_requests
                WHERE auction_org_id = _auction_org_id AND status = 'quoted'),
    -- Soạn & ký: trách nhiệm chính của tổ chức. Xác nhận: chỉ khi tổ chức chưa xác nhận.
    'contracts_action', (SELECT count(*) FROM public.consignment_contracts c
                          WHERE c.auction_org_id = _auction_org_id
                            AND (c.status IN ('drafting', 'awaiting_signatures')
                                 OR (c.status = 'awaiting_confirmation' AND c.org_confirmed_at IS NULL)))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_service_request_counts(UUID) TO authenticated;

-- ─── 2. Chủ tài sản ──────────────────────────────────────────────────────────
-- SECURITY INVOKER: RLS own-rows của asset_postings / asset_service_requests /
-- consignment_contracts / KYC đã giới hạn đúng người gọi — không cần quyền cao.

CREATE OR REPLACE FUNCTION public.owner_consignment_summary()
RETURNS TABLE (
  posting_id      UUID,
  quoted_count    INT,
  has_selection   BOOLEAN,
  contract_id     UUID,
  contract_status TEXT,
  owner_action    TEXT
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH addr AS (
    -- Cùng thứ tự với consignment_owner_party(): KYC tổ chức đã duyệt thắng cá nhân.
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM public.asset_owner_org_kyc k
                    WHERE k.created_by = auth.uid() AND k.status = 'approved')
        THEN NOT EXISTS (SELECT 1 FROM public.asset_owner_org_kyc k
                          WHERE k.created_by = auth.uid() AND k.status = 'approved'
                            AND btrim(COALESCE(k.head_office_address, '')) <> '')
      ELSE NOT EXISTS (SELECT 1 FROM public.asset_owner_kyc k
                        WHERE k.user_id = auth.uid() AND k.status = 'approved'
                          AND btrim(COALESCE(k.address, '')) <> '')
    END AS missing
  ),
  base AS (
    SELECT p.id,
           (SELECT count(*)::int FROM public.asset_service_requests r
             WHERE r.asset_posting_id = p.id AND r.status = 'quoted') AS quoted_count,
           EXISTS (SELECT 1 FROM public.asset_service_requests r
                    WHERE r.asset_posting_id = p.id AND r.status IN ('selected', 'accepted')) AS has_selection,
           c.id AS contract_id,
           c.status AS contract_status,
           c.owner_confirmed_at
      FROM public.asset_postings p
      LEFT JOIN LATERAL (
        SELECT cc.id, cc.status, cc.owner_confirmed_at
          FROM public.consignment_contracts cc
         WHERE cc.asset_posting_id = p.id AND cc.status <> 'cancelled'
         LIMIT 1
      ) c ON true
     WHERE p.user_id = auth.uid()
  )
  SELECT b.id, b.quoted_count, b.has_selection, b.contract_id, b.contract_status,
         CASE
           WHEN b.contract_status = 'awaiting_confirmation' AND b.owner_confirmed_at IS NULL
             THEN 'confirm_contract'
           WHEN b.contract_status IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation')
                AND (SELECT missing FROM addr)
             THEN 'add_address'
           WHEN NOT b.has_selection AND b.quoted_count > 0
             THEN 'choose_quote'
         END
    FROM base b;
$$;

REVOKE ALL ON FUNCTION public.owner_consignment_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_consignment_summary() TO authenticated;
