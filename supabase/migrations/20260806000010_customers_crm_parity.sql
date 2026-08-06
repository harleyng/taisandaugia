-- Đưa trang Khách hàng ngang tầm Khách hàng tiềm năng.
--
-- Ba việc:
--   1. customers trỏ được tới pháp nhân nguồn trên sàn (như leads đã làm ở
--      20260805000080) ⇒ trang khách hàng dựng được tab Lịch sử đấu giá /
--      Chi nhánh mà không phải dò ngược qua lead (lead có thể bị xóa).
--   2. customers.user_id — cột đã tồn tại từ 20260719000006 nhưng CHƯA CHỖ NÀO
--      ghi vào — nay là cầu nối duy nhất giữa một khách hàng CRM và các chiến
--      dịch email marketing (campaign_recipients.user_id).
--   3. admin_convert_lead ghi cả hai thứ trên khi chuyển đổi.

-- ─── 1. Con trỏ pháp nhân trên customers ─────────────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS prospect_kind TEXT
    CHECK (prospect_kind IN ('asset_owner', 'auction_org')),
  ADD COLUMN IF NOT EXISTS prospect_id UUID;

COMMENT ON COLUMN public.customers.prospect_id IS
  'Pháp nhân nguồn trên sàn (asset_owners.id hoặc auction_organizations.id), sao từ lead khi chuyển đổi.';

CREATE INDEX IF NOT EXISTS idx_customers_prospect
  ON public.customers (prospect_kind, prospect_id)
  WHERE prospect_id IS NOT NULL;

-- Backfill HAI CHIỀU: khách đã chuyển đổi trước migration này có thể tra ngược
-- qua customers.source_lead_id, nhưng khách sinh từ admin_win_opportunity thì
-- chỉ có leads.converted_customer_id trỏ tới. Chạy cả hai để không sót.
UPDATE public.customers c
   SET prospect_kind = l.prospect_kind, prospect_id = l.prospect_id
  FROM public.leads l
 WHERE l.id = c.source_lead_id
   AND c.prospect_id IS NULL
   AND l.prospect_id IS NOT NULL;

UPDATE public.customers c
   SET prospect_kind = l.prospect_kind, prospect_id = l.prospect_id
  FROM public.leads l
 WHERE l.converted_customer_id = c.id
   AND c.prospect_id IS NULL
   AND l.prospect_id IS NOT NULL;

-- ─── 2. Index tra chiến dịch email theo tài khoản ────────────────────────────
-- campaign_recipients chỉ có idx_campaign_recipients_campaign; unique index
-- (campaign_id, user_id) có campaign_id đứng đầu nên KHÔNG phục vụ được truy
-- vấn "mọi chiến dịch của user X" — thiếu index này là seq scan cả bảng.

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_user
  ON public.campaign_recipients (user_id)
  WHERE user_id IS NOT NULL;

-- ─── 3. Backfill customers.user_id theo email (một lần) ──────────────────────
-- idx_customers_user là UNIQUE partial ⇒ phải khử trùng CẢ HAI phía: mỗi khách
-- một tài khoản, mỗi tài khoản một khách.
--
-- CẢNH BÁO CÓ CHỦ Ý: khớp thuần theo email nên hộp thư dùng chung
-- (info@congty.vn) có thể gắn nhầm sang tài khoản nhân viên. Chấp nhận được vì
-- admin gỡ/gắn lại được bằng ô "Tài khoản trên sàn" ở form khách hàng.

WITH cand AS (
  SELECT DISTINCT ON (c.id) c.id AS customer_id, p.id AS user_id
    FROM public.customers c
    JOIN public.profiles  p ON lower(p.email) = lower(c.email)
   WHERE c.user_id IS NULL
     AND NULLIF(c.email, '') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.customers c2 WHERE c2.user_id = p.id)
   ORDER BY c.id, p.created_at
),
uniq AS (
  SELECT DISTINCT ON (user_id) customer_id, user_id
    FROM cand
   ORDER BY user_id, customer_id
)
UPDATE public.customers c
   SET user_id = u.user_id
  FROM uniq u
 WHERE c.id = u.customer_id;

-- ─── 4. admin_convert_lead: sao prospect + tự gắn tài khoản ──────────────────
-- Thân hàm giữ nguyên từ 20260719000007 (KHÔNG sửa file đó — đã áp), chỉ thêm:
--   (i)   dò tài khoản sàn theo email rồi tới SĐT,
--   (ii)  INSERT copy prospect_kind/prospect_id,
--   (iii) gắn user_id ở cả nhánh tạo mới lẫn nhánh gộp trùng.
-- Thứ tự khóa vẫn là lead → cơ hội → khách hàng (xem chú thích file gốc).

CREATE OR REPLACE FUNCTION public.admin_convert_lead(
  _lead_id     UUID,
  _customer_id UUID DEFAULT NULL   -- admin chọn khách có sẵn để gộp trùng
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead     public.leads%ROWTYPE;
  v_customer UUID;
  v_dup      UUID;
  v_phone    TEXT;
  v_user     UUID;
BEGIN
  IF NOT public.admin_has_permission('khach-hang-tiem-nang', 'update') THEN
    RAISE EXCEPTION 'Không có quyền chuyển đổi khách hàng tiềm năng'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy khách hàng tiềm năng' USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent theo CON TRỎ chứ không theo status: nếu khách hàng bị xóa,
  -- converted_customer_id thành NULL và lead chuyển đổi lại được, không kẹt.
  IF v_lead.converted_customer_id IS NOT NULL THEN
    RETURN v_lead.converted_customer_id;
  END IF;

  v_phone := regexp_replace(COALESCE(v_lead.phone, ''), '\D', '', 'g');

  -- Dò tài khoản trên sàn: email trước (khớp chắc nhất), rồi 9 số cuối SĐT qua
  -- auth.users (profiles KHÔNG có cột phone; SECURITY DEFINER đọc được auth).
  -- Bỏ qua tài khoản đã gắn khách khác — idx_customers_user là UNIQUE.
  IF NULLIF(v_lead.email, '') IS NOT NULL THEN
    SELECT p.id INTO v_user
      FROM public.profiles p
     WHERE lower(p.email) = lower(v_lead.email)
       AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.user_id = p.id)
     ORDER BY p.created_at
     LIMIT 1;
  END IF;

  IF v_user IS NULL AND length(v_phone) >= 9 THEN
    SELECT u.id INTO v_user
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
     WHERE u.phone IS NOT NULL
       AND right(regexp_replace(u.phone, '\D', '', 'g'), 9) = right(v_phone, 9)
       AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.user_id = u.id)
     ORDER BY u.created_at
     LIMIT 1;
  END IF;

  IF _customer_id IS NOT NULL THEN
    SELECT id INTO v_customer FROM public.customers WHERE id = _customer_id FOR UPDATE;
    IF v_customer IS NULL THEN
      RAISE EXCEPTION 'Không tìm thấy khách hàng để gộp' USING ERRCODE = 'no_data_found';
    END IF;

    -- Gộp: chỉ VÁ chỗ trống, không đè dữ liệu admin đã nhập tay.
    UPDATE public.customers c
       SET prospect_kind  = COALESCE(c.prospect_kind,  v_lead.prospect_kind),
           prospect_id    = COALESCE(c.prospect_id,    v_lead.prospect_id),
           source_lead_id = COALESCE(c.source_lead_id, v_lead.id)
     WHERE c.id = v_customer;
  ELSE
    -- Kiểm tra trùng LẠI bên trong transaction: bản ghi trùng có thể vừa xuất
    -- hiện sau khi UI đã dựng danh sách gợi ý.
    SELECT c.id INTO v_dup
      FROM public.customers c
     WHERE (NULLIF(v_phone, '') IS NOT NULL
            AND regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = v_phone)
        OR (NULLIF(v_lead.email, '') IS NOT NULL AND lower(c.email) = lower(v_lead.email))
     LIMIT 1;

    IF v_dup IS NOT NULL THEN
      RAISE EXCEPTION 'Đã có khách hàng trùng số điện thoại hoặc email — hãy chọn gộp vào khách hàng đó'
        USING ERRCODE = 'unique_violation';
    END IF;

    INSERT INTO public.customers (name, customer_type, segment, contact_name, phone, email,
                                  address, note, source_lead_id, prospect_kind, prospect_id)
    VALUES (
      COALESCE(NULLIF(v_lead.company_name, ''), v_lead.name),
      CASE WHEN v_lead.lead_type IN ('asset_owner','investor','broker') AND v_lead.company_name IS NULL
           THEN 'individual' ELSE 'company' END,
      v_lead.lead_type,                       -- cùng từ vựng ⇒ copy 1:1
      COALESCE(v_lead.contact_name, v_lead.name),
      v_lead.phone, v_lead.email, v_lead.province, v_lead.note, v_lead.id,
      v_lead.prospect_kind, v_lead.prospect_id
    )
    RETURNING id INTO v_customer;
  END IF;

  -- Gắn tài khoản sau cùng, trong khối bắt lỗi riêng: một lần chuyển đổi song
  -- song vừa chiếm mất tài khoản này thì bỏ qua, KHÔNG làm hỏng cả chuyển đổi.
  IF v_user IS NOT NULL THEN
    BEGIN
      UPDATE public.customers
         SET user_id = v_user
       WHERE id = v_customer AND user_id IS NULL;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;

  -- Dời mọi cơ hội đang treo ở lead sang khách hàng (giữ nguyên xor 1-trong-2).
  UPDATE public.opportunities
     SET customer_id = v_customer, lead_id = NULL
   WHERE lead_id = _lead_id;

  UPDATE public.leads
     SET status = 'converted', converted_customer_id = v_customer, converted_at = now()
   WHERE id = _lead_id;

  RETURN v_customer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_convert_lead(UUID, UUID) TO authenticated;
