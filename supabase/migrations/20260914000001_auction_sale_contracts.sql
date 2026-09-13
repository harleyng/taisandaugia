-- Hợp đồng mua bán tài sản đấu giá — xương sống pháp lý & tiền bạc sau khi
-- phiên chốt kết quả (Giai đoạn D, tiếp nối 20260913000001).
--
-- BỐI CẢNH. Sau `org_finalize_session`, mỗi lô bán được chỉ có: người trúng
-- (`winner_contract_id`), giá trúng, hạn 30 ngày và MỘT cờ một-lần
-- `payment_status`. Không có hợp đồng mua bán, không biết đã trả bao nhiêu,
-- không có bàn giao, không có phía bên bán. Migration này bù đúng khoảng đó.
--
-- MÁY TRẠNG THÁI
--   drafting ──chia sẻ dự thảo──▶ awaiting_signatures ──tải bản ký──▶
--   awaiting_confirmation ──đủ chữ ký xác nhận──▶ signed
--   signed ──trả đủ tiền + bàn giao xong──▶ completed
--   (mọi trạng thái trừ completed) ──▶ cancelled
--
-- QUYẾT ĐỊNH 2026-09-12
--  1. MỘT hợp đồng cho MỘT lô đã bán, do tổ chức tạo TƯỜNG MINH sau khi chốt
--     phiên. Không tự sinh lúc finalize: nhiều tổ chức ký giấy ngoài sàn, ép
--     tạo dòng sẽ đẻ ra hợp đồng ma.
--  2. BÊN BÁN suy từ nguồn của lô — hai chuỗi khác hẳn nhau:
--       lô `posting`  → chủ tài sản CÓ tài khoản (consignment_contracts.owner_user_id)
--                       ⇒ seller_kind = 'owner_user', tự thao tác trong cổng chủ tài sản
--       lô `listing`  → chủ tài sản chỉ là thực thể danh bạ (asset_owners), KHÔNG có
--                       tài khoản ⇒ seller_kind = 'org_on_behalf', tổ chức ký thay
--     Không có bên bán ⇒ `seller_unresolved`. KHÔNG bịa ra một bên bán.
--  3. TIỀN là SỔ GHI THÊM (`auction_sale_payments`) + lịch kỳ hạn
--     (`auction_sale_installments`), không phải một nút bấm. Số dư =
--     price − deposit_credit − Σ(thu ròng). Khi số dư về 0, chính RPC sổ tiền
--     lật `auction_lot_states.payment_status = 'paid'` — ĐÚNG cột mà bước 6 đọc.
--     ⇒ Hai bên ghi cùng một cột: `org_confirm_winner_payment` (giữ lại cho tổ
--     chức không dùng hợp đồng) và RPC sổ tiền. LUẬT: hễ đã có hợp đồng thì UI
--     không bao giờ hiện nút cũ nữa. Ghi ở common-pitfalls.md.
--  4. HOÀN TIỀN là một DÒNG MỚI (`reversed_payment_id` trỏ về dòng bị hoàn),
--     không bao giờ UPDATE. Giữ `amount > 0`, dòng hoàn mang dấu trừ khi cộng.
--  5. HUỶ kéo theo hậu quả tiền đặt trước, ĐÚNG ngữ nghĩa bước 6:
--       buyer_refused  → cọc MẤT (forfeited) + lô `defaulted`  (Điều 39 Luật ĐGTS)
--       seller_refused → cọc chờ hoàn (pending_refund)
--       mutual         → cọc chờ hoàn (pending_refund)
--
-- NGOÀI PHẠM VI: người trả giá liền kề (Điều 51), huỷ kết quả đấu giá (Điều
-- 72), công chứng (chỉ ghi nhận), sổ thanh toán tổ chức→bên bán, VNPay thật.
--
-- Bản TS soi gương phần suy luận: src/lib/saleContracts/{stage,money}.ts.
-- Mẫu điều khoản HDMB-MAU-2026-09 CHƯA RÀ SOÁT PHÁP LÝ (như HDDV-MAU, BBDG-MAU).

-- ─── 1. Bảng ────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.auction_sale_contract_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.auction_sale_contracts (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,                 -- 'HDMB' + lpad(nextval, 6, '0')
  contract_no TEXT,                 -- số hợp đồng do tổ chức tự đánh

  -- Lô là DUY NHẤT một hợp đồng còn sống. RESTRICT: hợp đồng là chứng cứ, xoá
  -- lô mà kéo theo hợp đồng thì mất dấu vết mua bán.
  lot_id          UUID NOT NULL REFERENCES public.auction_session_items(id) ON DELETE RESTRICT,
  session_id      UUID NOT NULL REFERENCES public.auction_sessions(id)      ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id)         ON DELETE RESTRICT,
  auction_org_id  UUID          REFERENCES public.auction_organizations(id) ON DELETE SET NULL,

  -- Bên mua: luôn là hồ sơ tham gia đã trúng. user_id có thể mất (xoá tài
  -- khoản) nhưng bản chiếu danh tính thì không.
  buyer_contract_id UUID NOT NULL REFERENCES public.auction_bidding_contracts(id) ON DELETE RESTRICT,
  buyer_user_id     UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Bên bán: hai chuỗi, xem ghi chú đầu file.
  seller_kind           TEXT NOT NULL CHECK (seller_kind IN ('owner_user','org_on_behalf')),
  seller_user_id        UUID REFERENCES auth.users(id)   ON DELETE SET NULL,
  seller_asset_owner_id UUID REFERENCES public.asset_owners(id) ON DELETE SET NULL,
  consignment_contract_id UUID REFERENCES public.consignment_contracts(id) ON DELETE SET NULL,

  -- Bản chiếu đóng băng lúc tạo; `share_draft` làm mới khi hợp đồng chưa ký.
  buyer_party    JSONB NOT NULL DEFAULT '{}'::jsonb,
  seller_party   JSONB NOT NULL DEFAULT '{}'::jsonb,
  org_party      JSONB NOT NULL DEFAULT '{}'::jsonb,
  asset_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  price          NUMERIC(18,0) NOT NULL CHECK (price > 0),            -- = winning_amount
  deposit_credit NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (deposit_credit >= 0),

  payee_side     TEXT NOT NULL DEFAULT 'org' CHECK (payee_side IN ('seller','org')),
  payee_bank_info TEXT,

  org_signs             BOOLEAN NOT NULL DEFAULT false,
  notarization_required BOOLEAN NOT NULL DEFAULT false,
  notarized_at  TIMESTAMPTZ,
  notary_office TEXT,

  status TEXT NOT NULL DEFAULT 'drafting' CHECK (status IN
    ('drafting','awaiting_signatures','awaiting_confirmation','signed','completed','cancelled')),

  sign_due_at       TIMESTAMPTZ,
  draft_doc_path    TEXT,
  draft_source      TEXT CHECK (draft_source IS NULL OR draft_source IN ('generated','uploaded')),
  draft_uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  draft_uploaded_at TIMESTAMPTZ,

  signed_doc_path      TEXT,
  signed_uploaded_side TEXT CHECK (signed_uploaded_side IS NULL OR signed_uploaded_side IN ('buyer','seller','org')),
  signed_uploaded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_uploaded_at   TIMESTAMPTZ,
  signed_date          DATE,

  buyer_confirmed_at  TIMESTAMPTZ, buyer_confirmed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_confirmed_at TIMESTAMPTZ, seller_confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_confirmed_at    TIMESTAMPTZ, org_confirmed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  signed_at           TIMESTAMPTZ,

  paid_at TIMESTAMPTZ,              -- SUY RA: số dư về 0 (RPC sổ tiền đặt)

  handover_due_at       TIMESTAMPTZ,
  handover_scheduled_at TIMESTAMPTZ,
  handover_location     TEXT,
  handover_doc_path     TEXT,
  handover_buyer_confirmed_at  TIMESTAMPTZ, handover_buyer_confirmed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  handover_seller_confirmed_at TIMESTAMPTZ, handover_seller_confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  handed_over_at TIMESTAMPTZ,

  title_transfer_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (title_transfer_status IN ('not_required','pending','submitted','completed')),
  title_transfer_note     TEXT,
  title_transfer_doc_path TEXT,

  completed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ, cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_side TEXT CHECK (cancelled_side IS NULL OR cancelled_side IN ('buyer','seller','org')),
  cancel_kind    TEXT CHECK (cancel_kind IS NULL OR cancel_kind IN ('buyer_refused','seller_refused','mutual')),
  cancel_reason  TEXT,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT asc_seller_shape CHECK (
    (seller_kind = 'owner_user'    AND seller_user_id IS NOT NULL) OR
    (seller_kind = 'org_on_behalf' AND seller_asset_owner_id IS NOT NULL)),
  CONSTRAINT asc_deposit_le_price   CHECK (deposit_credit <= price),
  CONSTRAINT asc_awaiting_sig_draft CHECK (status <> 'awaiting_signatures' OR draft_doc_path  IS NOT NULL),
  CONSTRAINT asc_awaiting_conf_scan CHECK (status <> 'awaiting_confirmation' OR signed_doc_path IS NOT NULL),
  CONSTRAINT asc_signed_complete CHECK (status NOT IN ('signed','completed') OR (
      signed_doc_path IS NOT NULL AND signed_date IS NOT NULL AND signed_at IS NOT NULL
      AND buyer_confirmed_at IS NOT NULL AND seller_confirmed_at IS NOT NULL
      AND (NOT org_signs OR org_confirmed_at IS NOT NULL))),
  CONSTRAINT asc_completed_shape CHECK (status <> 'completed' OR
      (paid_at IS NOT NULL AND handed_over_at IS NOT NULL AND completed_at IS NOT NULL)),
  CONSTRAINT asc_cancel_shape CHECK (status <> 'cancelled' OR (
      cancelled_at IS NOT NULL AND cancel_kind IS NOT NULL
      AND char_length(btrim(COALESCE(cancel_reason,''))) >= 10))
);

-- Một lô chỉ có MỘT hợp đồng còn sống; huỷ rồi thì lập lại được.
CREATE UNIQUE INDEX IF NOT EXISTS uq_asc_one_open_per_lot
  ON public.auction_sale_contracts (lot_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_asc_org_status ON public.auction_sale_contracts (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_asc_session    ON public.auction_sale_contracts (session_id);
CREATE INDEX IF NOT EXISTS idx_asc_buyer      ON public.auction_sale_contracts (buyer_user_id)  WHERE buyer_user_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asc_seller     ON public.auction_sale_contracts (seller_user_id) WHERE seller_user_id IS NOT NULL;

-- Lịch kỳ hạn. Σ amount = price − deposit_credit, do RPC điều khoản ép (sửa
-- theo BỘ nên không đặt được CHECK trên từng dòng).
CREATE TABLE IF NOT EXISTS public.auction_sale_installments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.auction_sale_contracts(id) ON DELETE CASCADE,
  seq         INT  NOT NULL CHECK (seq > 0),
  label       TEXT,
  due_at      TIMESTAMPTZ,
  amount      NUMERIC(18,0) NOT NULL CHECK (amount > 0),
  paid_amount NUMERIC(18,0) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT asi_seq_uq UNIQUE (contract_id, seq),
  CONSTRAINT asi_paid_le_amount CHECK (paid_amount <= amount)
);
CREATE INDEX IF NOT EXISTS idx_asi_contract ON public.auction_sale_installments (contract_id, seq);

-- Sổ tiền CHỈ GHI THÊM. Dòng có `reversed_payment_id` là dòng HOÀN của đúng
-- một dòng thu trước đó; cộng vào sổ với dấu trừ.
CREATE TABLE IF NOT EXISTS public.auction_sale_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID NOT NULL REFERENCES public.auction_sale_contracts(id) ON DELETE CASCADE,
  -- RESTRICT chứ KHÔNG phải SET NULL: `SET NULL` là một UPDATE, mà guard
  -- chỉ-ghi-thêm chặn mọi UPDATE lên bảng này. Đổi lịch kỳ hạn khi đã có
  -- tiền vào sổ bị RPC điều khoản từ chối bằng lý do `payments_exist`.
  installment_id UUID REFERENCES public.auction_sale_installments(id) ON DELETE RESTRICT,
  amount    NUMERIC(18,0) NOT NULL CHECK (amount > 0),
  method    TEXT NOT NULL CHECK (method IN ('bank_transfer','cash','vnpay_mock','other')),
  txn_ref   TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence_path TEXT,
  note      TEXT,
  reversed_payment_id UUID REFERENCES public.auction_sale_payments(id) ON DELETE RESTRICT,
  reversal_reason TEXT,
  recorded_by UUID,               -- không FK: ON DELETE là UPDATE, guard chỉ-ghi-thêm chặn
  at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- Mỗi dòng thu chỉ hoàn được MỘT lần.
CREATE UNIQUE INDEX IF NOT EXISTS uq_asp_one_reversal
  ON public.auction_sale_payments (reversed_payment_id) WHERE reversed_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asp_contract ON public.auction_sale_payments (contract_id, at);

CREATE TABLE IF NOT EXISTS public.auction_sale_contract_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.auction_sale_contracts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'created','terms_updated','draft_shared','signed_uploaded','confirmed','signed',
    'payment','payment_reversed','handover_scheduled','handover_confirmed','handed_over',
    'title_transfer','completed','cancelled')),
  side     TEXT CHECK (side IS NULL OR side IN ('buyer','seller','org')),
  actor_id UUID,
  data     JSONB NOT NULL DEFAULT '{}'::jsonb,
  at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_asce_contract ON public.auction_sale_contract_events (contract_id, at);

-- Phòng thủ nhiều lớp: không client nào ghi thẳng, mọi thay đổi đi qua RPC.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.auction_sale_contracts, public.auction_sale_installments,
  public.auction_sale_payments,  public.auction_sale_contract_events
  FROM anon, authenticated;

-- ─── 2. Bối cảnh RPC + guard ────────────────────────────────────────────────
-- Cùng thủ pháp với `app.bidding_rpc`: một GUC chỉ đặt được từ trong hàm
-- SECURITY DEFINER (PostgREST không cho client set GUC tuỳ ý), nên guard biết
-- thay đổi đến từ RPC hợp lệ hay từ một đường vòng nào khác.

CREATE OR REPLACE FUNCTION public._sale_rpc_active() RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT COALESCE(current_setting('app.sale_rpc', true), '') = 'on' $$;

CREATE OR REPLACE FUNCTION public._sale_ctx() RETURNS VOID
LANGUAGE sql SET search_path = public
AS $$ SELECT set_config('app.sale_rpc', 'on', true) $$;

CREATE OR REPLACE FUNCTION public._sale_ctx_clear() RETURNS VOID
LANGUAGE sql SET search_path = public
AS $$ SELECT set_config('app.sale_rpc', '', true) $$;

REVOKE EXECUTE ON FUNCTION public._sale_rpc_active() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._sale_ctx()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._sale_ctx_clear()  FROM PUBLIC, anon, authenticated;

-- Mã hợp đồng do server cấp.
CREATE OR REPLACE FUNCTION public.auction_sale_contracts_fill() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    NEW.code := 'HDMB' || lpad(nextval('public.auction_sale_contract_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_sale_contracts_fill ON public.auction_sale_contracts;
CREATE TRIGGER auction_sale_contracts_fill
  BEFORE INSERT ON public.auction_sale_contracts
  FOR EACH ROW EXECUTE FUNCTION public.auction_sale_contracts_fill();

-- Guard SỬA. Tên phải sắp xếp TRƯỚC `..._updated_at` để chạy trước.
-- Qua RPC (GUC bật) thì cho qua; ngoài RPC thì cấm sửa trạng thái cuối và
-- khôi phục các cột server sở hữu.
CREATE OR REPLACE FUNCTION public.auction_sale_contracts_guard() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public._sale_rpc_active() THEN RETURN NEW; END IF;

  IF OLD.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Hợp đồng mua bán % đã kết thúc, không sửa được nữa.', OLD.code
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.id                := OLD.id;
  NEW.code              := OLD.code;
  NEW.lot_id            := OLD.lot_id;
  NEW.session_id        := OLD.session_id;
  NEW.organization_id   := OLD.organization_id;
  NEW.buyer_contract_id := OLD.buyer_contract_id;
  NEW.price             := OLD.price;
  NEW.created_at        := OLD.created_at;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS auction_sale_contracts_guard ON public.auction_sale_contracts;
CREATE TRIGGER auction_sale_contracts_guard
  BEFORE UPDATE ON public.auction_sale_contracts
  FOR EACH ROW EXECUTE FUNCTION public.auction_sale_contracts_guard();

DROP TRIGGER IF EXISTS auction_sale_contracts_updated_at ON public.auction_sale_contracts;
CREATE TRIGGER auction_sale_contracts_updated_at
  BEFORE UPDATE ON public.auction_sale_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sổ tiền và nhật ký: chỉ ghi thêm. Dùng lại đúng hàm của engine đấu giá —
-- nó không SECURITY DEFINER và không có cửa thoát GUC, nên seed/teardown phải
-- DISABLE TRIGGER như các bảng đấu giá.
DROP TRIGGER IF EXISTS auction_sale_payments_append_only ON public.auction_sale_payments;
CREATE TRIGGER auction_sale_payments_append_only
  BEFORE UPDATE OR DELETE ON public.auction_sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.auction_append_only_guard();

DROP TRIGGER IF EXISTS auction_sale_contract_events_append_only ON public.auction_sale_contract_events;
CREATE TRIGGER auction_sale_contract_events_append_only
  BEFORE UPDATE OR DELETE ON public.auction_sale_contract_events
  FOR EACH ROW EXECUTE FUNCTION public.auction_append_only_guard();

-- ─── 3. Hàm quyền ───────────────────────────────────────────────────────────
-- Nhánh `owner_id` là BẮT BUỘC: `org_has_permission` chỉ thấy thành viên
-- ACTIVE, chủ tổ chức chưa chắc có dòng membership.
CREATE OR REPLACE FUNCTION public.can_manage_sale_contracts(_org_id UUID, _action TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'hop-dong-mua-ban', _action)
      OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org_id AND o.owner_id = auth.uid())
$$;

-- Người đang đăng nhập có được đóng vai `_side` của hợp đồng này không.
--   buyer  ⇔ chính người trúng
--   seller ⇔ chủ tài sản có tài khoản, HOẶC tổ chức khi lô là tin đăng danh bạ
--   org    ⇔ thành viên tổ chức có quyền `update`
CREATE OR REPLACE FUNCTION public.sale_can_act(_contract_id UUID, _side TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE _side
    WHEN 'buyer'  THEN c.buyer_user_id IS NOT NULL AND c.buyer_user_id = auth.uid()
    WHEN 'seller' THEN (c.seller_kind = 'owner_user'    AND c.seller_user_id = auth.uid())
                    OR (c.seller_kind = 'org_on_behalf' AND public.can_manage_sale_contracts(c.organization_id, 'update'))
    WHEN 'org'    THEN public.can_manage_sale_contracts(c.organization_id, 'update')
    ELSE false END
  FROM public.auction_sale_contracts c WHERE c.id = _contract_id
$$;

-- Hợp đồng có nằm trong tầm nhìn của người gọi không (dùng cho RLS bảng con).
CREATE OR REPLACE FUNCTION public.sale_contract_visible(_contract_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_sale_contracts c
     WHERE c.id = _contract_id
       AND (c.buyer_user_id = auth.uid()
         OR c.seller_user_id = auth.uid()
         OR public.can_manage_sale_contracts(c.organization_id, 'view')
         OR public.has_role(auth.uid(), 'ADMIN'::app_role)))
$$;

REVOKE ALL ON FUNCTION public.can_manage_sale_contracts(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_can_act(UUID, TEXT)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_visible(UUID)           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_sale_contracts(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_can_act(UUID, TEXT)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_visible(UUID)           TO authenticated;

-- ─── 4. RLS — CHỈ ĐỌC ───────────────────────────────────────────────────────
-- Dòng hợp đồng mang CCCD/địa chỉ của CẢ HAI bên. Đó là bản chất của một hợp
-- đồng giữa họ với nhau, và đúng bằng thứ tổ chức đã thấy ở `ho-so-tham-gia`.
-- KHÔNG có policy công khai: người ngoài không bao giờ thấy giá mua, tiến độ
-- trả tiền hay lịch bàn giao.

ALTER TABLE public.auction_sale_contracts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_sale_installments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_sale_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_sale_contract_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asc_party_read ON public.auction_sale_contracts;
CREATE POLICY asc_party_read ON public.auction_sale_contracts FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid()
         OR public.can_manage_sale_contracts(organization_id, 'view'));

DROP POLICY IF EXISTS asc_admin_read ON public.auction_sale_contracts;
CREATE POLICY asc_admin_read ON public.auction_sale_contracts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS asi_read ON public.auction_sale_installments;
CREATE POLICY asi_read ON public.auction_sale_installments FOR SELECT TO authenticated
  USING (public.sale_contract_visible(contract_id));

DROP POLICY IF EXISTS asp_read ON public.auction_sale_payments;
CREATE POLICY asp_read ON public.auction_sale_payments FOR SELECT TO authenticated
  USING (public.sale_contract_visible(contract_id));

DROP POLICY IF EXISTS asce_read ON public.auction_sale_contract_events;
CREATE POLICY asce_read ON public.auction_sale_contract_events FOR SELECT TO authenticated
  USING (public.sale_contract_visible(contract_id));

-- ─── 5. Storage: tệp hợp đồng mua bán ───────────────────────────────────────
-- Bucket PRIVATE. Path BẮT BUỘC {organization_id}/{contract_id}/{kind}-{epoch}-{tên}
-- — policy đọc hai đoạn đầu để tìm hợp đồng. Không có UPDATE/DELETE: tệp là
-- chứng cứ, thay bản ký = tải tệp MỚI rồi trỏ lại.
--
-- ⚠️ Dự thảo PDF in CCCD/địa chỉ của cả hai bên (khác biên bản công khai) nên
-- bucket này TUYỆT ĐỐI không được có policy cho anon — mục 9 kiểm lại điều đó.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('auction-sale-contracts', 'auction-sale-contracts', false, 10485760,
        ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE SET public = false,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.sale_path_uuid(_name TEXT, _seg INT) RETURNS UUID
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  RETURN split_part(_name, '/', _seg)::uuid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END; $$;

-- NULL = hợp lệ; ngược lại trả mã lý do cho RPC.
CREATE OR REPLACE FUNCTION public.sale_contract_file_check(
  _organization_id UUID, _contract_id UUID, _path TEXT, _kind TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _path IS NULL
     OR public.sale_path_uuid(_path, 1) IS DISTINCT FROM _organization_id
     OR public.sale_path_uuid(_path, 2) IS DISTINCT FROM _contract_id
     OR split_part(_path, '/', 3) NOT LIKE _kind || '-%'
     OR split_part(_path, '/', 4) <> '' THEN
    RETURN 'invalid_path';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o
                  WHERE o.bucket_id = 'auction-sale-contracts' AND o.name = _path) THEN
    RETURN 'file_missing';
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.can_read_sale_contract_file(_name TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.sale_contract_visible(public.sale_path_uuid(_name, 2)) $$;

CREATE OR REPLACE FUNCTION public.can_upload_sale_contract_file(_name TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_sale_contracts c
     WHERE c.id = public.sale_path_uuid(_name, 2)
       AND c.organization_id = public.sale_path_uuid(_name, 1)
       -- `completed` VẪN tải được: giấy sang tên về sau khi hợp đồng hoàn tất.
       AND c.status <> 'cancelled'
       AND (public.sale_can_act(c.id, 'buyer')
         OR public.sale_can_act(c.id, 'seller')
         OR public.sale_can_act(c.id, 'org')))
$$;

REVOKE ALL ON FUNCTION public.sale_path_uuid(TEXT, INT)                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sale_contract_file_check(UUID, UUID, TEXT, TEXT)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_read_sale_contract_file(TEXT)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_upload_sale_contract_file(TEXT)                FROM PUBLIC, anon;
-- Hai hàm dưới được GỌI TRONG POLICY dưới vai người dùng ⇒ bắt buộc GRANT.
GRANT EXECUTE ON FUNCTION public.can_read_sale_contract_file(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_sale_contract_file(TEXT) TO authenticated;

DROP POLICY IF EXISTS auction_sale_contract_files_read ON storage.objects;
CREATE POLICY auction_sale_contract_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'auction-sale-contracts' AND public.can_read_sale_contract_file(name));

DROP POLICY IF EXISTS auction_sale_contract_files_insert ON storage.objects;
CREATE POLICY auction_sale_contract_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'auction-sale-contracts' AND public.can_upload_sale_contract_file(name));

-- ─── 6. Helper nội bộ ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._sale_lock(_contract_id UUID) RETURNS VOID
LANGUAGE sql SET search_path = public
AS $$ SELECT pg_advisory_xact_lock(hashtextextended('sale:' || _contract_id::text, 0)) $$;

CREATE OR REPLACE FUNCTION public._sale_event(
  _contract_id UUID, _action TEXT, _side TEXT DEFAULT NULL, _data JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.auction_sale_contract_events (contract_id, action, side, actor_id, data)
  VALUES (_contract_id, _action, _side, auth.uid(), COALESCE(_data, '{}'::jsonb))
$$;

-- Bản chiếu BÊN MUA — từ hồ sơ tham gia đã trúng (danh tính đã đóng băng lúc
-- nộp hồ sơ, kể cả khi tài khoản bị xoá về sau).
CREATE OR REPLACE FUNCTION public.sale_buyer_snapshot(_buyer_contract_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'dossier_code', c.code, 'bidder_no', c.bidder_no,
    'full_name', c.full_name, 'id_type', c.id_type, 'id_number', c.id_number,
    'date_of_birth', c.date_of_birth, 'gender', c.gender,
    'phone', c.phone, 'email', c.email, 'address', c.address)
  FROM public.auction_bidding_contracts c WHERE c.id = _buyer_contract_id
$$;

-- Bản chiếu BÊN BÁN — hai chuỗi, xem ghi chú đầu file. NULL ⇒ seller_unresolved.
CREATE OR REPLACE FUNCTION public.sale_seller_snapshot(_lot_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; cc RECORD; ao RECORD; v_party JSONB;
BEGIN
  SELECT i.id, i.source, i.listing_id, i.service_request_id INTO it
    FROM public.auction_session_items i WHERE i.id = _lot_id;
  IF it.id IS NULL THEN RETURN NULL; END IF;

  IF it.source = 'posting' THEN
    -- Hợp đồng ký gửi đã huỷ thì `owner_party` không còn dùng được (RPC tổ
    -- chức cũng giấu nó) ⇒ coi như không có bên bán.
    SELECT c.id, c.owner_user_id, c.owner_party INTO cc
      FROM public.consignment_contracts c
     WHERE c.service_request_id = it.service_request_id AND c.status <> 'cancelled'
     ORDER BY c.created_at DESC LIMIT 1;
    IF cc.id IS NULL OR cc.owner_user_id IS NULL THEN RETURN NULL; END IF;
    v_party := COALESCE(NULLIF(cc.owner_party, '{}'::jsonb), public.consignment_owner_party(cc.owner_user_id));
    RETURN jsonb_build_object(
      'seller_kind', 'owner_user',
      'seller_user_id', cc.owner_user_id,
      'consignment_contract_id', cc.id,
      'seller_party', COALESCE(v_party, '{}'::jsonb));
  END IF;

  -- Lô tin đăng: chủ tài sản chỉ là thực thể danh bạ, KHÔNG có tài khoản.
  SELECT o.id, o.name, o.address, o.owner_kind INTO ao
    FROM public.listings l JOIN public.asset_owners o ON o.id = l.asset_owner_id
   WHERE l.id = it.listing_id;
  IF ao.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'seller_kind', 'org_on_behalf',
    'seller_asset_owner_id', ao.id,
    'seller_party', jsonb_build_object(
      'kind', 'registry', 'name', ao.name, 'address', ao.address, 'owner_kind', ao.owner_kind));
END; $$;

CREATE OR REPLACE FUNCTION public.sale_asset_snapshot(_lot_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'lot_no', i.lot_no, 'title', i.title, 'category_slug', i.category_slug,
    'province', i.province, 'district', i.district, 'image_url', i.image_url,
    'starting_price', i.starting_price, 'source', i.source,
    'session_code', s.code, 'session_title', s.title, 'session_ends_at', s.ends_at)
  FROM public.auction_session_items i JOIN public.auction_sessions s ON s.id = i.session_id
  WHERE i.id = _lot_id
$$;

-- Thu RÒNG: dòng hoàn mang dấu trừ. Giữ `amount > 0` nên phép cộng ở đây là
-- NƠI DUY NHẤT biết dấu — bản TS `netPaidOf` phải khớp đúng công thức này.
CREATE OR REPLACE FUNCTION public.sale_net_paid(_contract_id UUID) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(CASE WHEN p.reversed_payment_id IS NULL THEN p.amount ELSE -p.amount END), 0)
  FROM public.auction_sale_payments p WHERE p.contract_id = _contract_id
$$;

CREATE OR REPLACE FUNCTION public.sale_balance(_contract_id UUID) RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.price - c.deposit_credit - public.sale_net_paid(_contract_id)
  FROM public.auction_sale_contracts c WHERE c.id = _contract_id
$$;

-- Phân bổ FIFO. Tính LẠI TỪ ĐẦU sau mỗi lần thu/hoàn thay vì cộng dồn: một
-- dòng hoàn sẽ tự mở lại đúng những kỳ đã đóng, không cần logic ngược.
-- Bản TS `allocateFifo` soi gương đúng vòng lặp này.
CREATE OR REPLACE FUNCTION public._sale_reallocate(_contract_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pool NUMERIC; r RECORD; v_take NUMERIC;
BEGIN
  -- Tiền đặt trước đã chuyển thành tiền mua tính vào kỳ đầu tiên trước tiên.
  v_pool := public.sale_net_paid(_contract_id);
  FOR r IN SELECT id, seq, amount, paid_at FROM public.auction_sale_installments
            WHERE contract_id = _contract_id ORDER BY seq LOOP
    v_take := LEAST(GREATEST(v_pool, 0), r.amount);
    UPDATE public.auction_sale_installments
       SET paid_amount = v_take,
           paid_at = CASE WHEN v_take >= r.amount THEN COALESCE(r.paid_at, clock_timestamp()) ELSE NULL END
     WHERE id = r.id;
    v_pool := v_pool - v_take;
  END LOOP;
END; $$;

-- Đồng bộ số dư → `paid_at` của hợp đồng VÀ `payment_status` của lô.
-- Đây là chỗ DUY NHẤT sổ tiền chạm vào bảng của engine đấu giá.
CREATE OR REPLACE FUNCTION public._sale_settle(_contract_id UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD; v_bal NUMERIC; v_now TIMESTAMPTZ := clock_timestamp(); v_full BOOLEAN;
BEGIN
  PERFORM public._sale_reallocate(_contract_id);
  SELECT id, lot_id, paid_at, status INTO c
    FROM public.auction_sale_contracts WHERE id = _contract_id;
  v_bal  := public.sale_balance(_contract_id);
  v_full := v_bal <= 0;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET paid_at = CASE WHEN v_full THEN COALESCE(c.paid_at, v_now) ELSE NULL END
   WHERE id = _contract_id;
  PERFORM public._sale_ctx_clear();

  -- Lô chỉ đổi khi đang ở hai trạng thái do sổ tiền làm chủ; KHÔNG đụng vào
  -- lô đã `defaulted` (người trúng bỏ cọc là quyết định khác).
  UPDATE public.auction_lot_states
     SET payment_status       = CASE WHEN v_full THEN 'paid' ELSE 'pending' END,
         payment_confirmed_at = CASE WHEN v_full THEN v_now ELSE NULL END
   WHERE lot_id = c.lot_id AND payment_status IN ('pending','paid');
  RETURN v_full;
END; $$;

-- Chuyển sang `completed` khi đã trả đủ VÀ đã bàn giao.
CREATE OR REPLACE FUNCTION public._sale_maybe_complete(_contract_id UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD;
BEGIN
  SELECT id, status, paid_at, handed_over_at INTO c
    FROM public.auction_sale_contracts WHERE id = _contract_id;
  IF c.status <> 'signed' OR c.paid_at IS NULL OR c.handed_over_at IS NULL THEN RETURN false; END IF;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET status = 'completed', completed_at = clock_timestamp() WHERE id = _contract_id;
  PERFORM public._sale_ctx_clear();
  PERFORM public._sale_event(_contract_id, 'completed', NULL, '{}'::jsonb);
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public._sale_lock(UUID)                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sale_event(UUID, TEXT, TEXT, JSONB)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sale_buyer_snapshot(UUID)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sale_seller_snapshot(UUID)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sale_asset_snapshot(UUID)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sale_net_paid(UUID)                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sale_balance(UUID)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sale_reallocate(UUID)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sale_settle(UUID)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sale_maybe_complete(UUID)                FROM PUBLIC, anon, authenticated;

-- ─── 7. RPC ─────────────────────────────────────────────────────────────────
-- Mọi RPC ghi: khoá tư vấn `sale:{id}` → SELECT … FOR UPDATE → ghi → dòng sự
-- kiện, trong CÙNG một giao dịch. Thất bại DỰ KIẾN trả {ok:false, reason} chứ
-- không RAISE — câu chữ tiếng Việt nằm ở src/lib/saleContracts/errors.ts.

-- Tạo hợp đồng cho MỘT lô đã bán.
CREATE OR REPLACE FUNCTION public.org_create_sale_contract(
  _lot_id UUID,
  _payee_side TEXT DEFAULT 'org',
  _org_signs  BOOLEAN DEFAULT false,
  _sign_due_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it RECORD; st public.auction_lot_states; bc RECORD;
  v_seller JSONB; v_deposit NUMERIC; v_used NUMERIC; v_id UUID;
  v_now TIMESTAMPTZ := clock_timestamp(); v_sign_due TIMESTAMPTZ; v_due TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF COALESCE(_payee_side, 'org') NOT IN ('seller','org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payee');
  END IF;

  SELECT i.id, i.lot_no, i.session_id, s.organization_id, s.auction_org_id, s.finalized_at
    INTO it
    FROM public.auction_session_items i JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR NOT public.can_manage_sale_contracts(it.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF it.finalized_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_finalized'); END IF;

  -- Cùng khoá với engine đấu giá ⇒ không đua với chốt phiên / xác nhận cọc.
  PERFORM pg_advisory_xact_lock(hashtextextended('bidding:' || it.session_id::text, 0));
  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.result IS DISTINCT FROM 'sold' OR st.winner_contract_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_not_sold');
  END IF;
  IF st.payment_status = 'defaulted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_defaulted');
  END IF;
  IF EXISTS (SELECT 1 FROM public.auction_sale_contracts c
              WHERE c.lot_id = _lot_id AND c.status <> 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_exists');
  END IF;

  v_seller := public.sale_seller_snapshot(_lot_id);
  IF v_seller IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'seller_unresolved'); END IF;

  SELECT id, user_id, deposit_status, deposit_amount_received INTO bc
    FROM public.auction_bidding_contracts WHERE id = st.winner_contract_id;

  -- Tiền đặt trước chỉ thành tiền mua khi engine đã chuyển sang `applied`.
  -- Cọc nộp theo PHIÊN (một lần cho mọi lô) nên phải trừ phần đã ghi cho các
  -- hợp đồng khác của cùng hồ sơ, nếu không một người trúng hai lô sẽ được
  -- tính cọc hai lần.
  v_deposit := CASE WHEN bc.deposit_status = 'applied'
                    THEN COALESCE(bc.deposit_amount_received, 0) ELSE 0 END;
  SELECT COALESCE(SUM(c.deposit_credit), 0) INTO v_used
    FROM public.auction_sale_contracts c
   WHERE c.buyer_contract_id = st.winner_contract_id AND c.status <> 'cancelled';
  v_deposit := LEAST(GREATEST(v_deposit - v_used, 0), st.winning_amount);

  v_sign_due := COALESCE(_sign_due_at, v_now + interval '7 days');
  v_due      := COALESCE(st.payment_due_at, v_now + interval '30 days');

  INSERT INTO public.auction_sale_contracts (
    lot_id, session_id, organization_id, auction_org_id,
    buyer_contract_id, buyer_user_id,
    seller_kind, seller_user_id, seller_asset_owner_id, consignment_contract_id,
    buyer_party, seller_party, org_party, asset_snapshot,
    price, deposit_credit, payee_side, org_signs,
    status, sign_due_at, created_by)
  VALUES (
    _lot_id, it.session_id, it.organization_id, it.auction_org_id,
    st.winner_contract_id, bc.user_id,
    v_seller ->> 'seller_kind',
    (v_seller ->> 'seller_user_id')::uuid,
    (v_seller ->> 'seller_asset_owner_id')::uuid,
    (v_seller ->> 'consignment_contract_id')::uuid,
    public.sale_buyer_snapshot(st.winner_contract_id),
    v_seller -> 'seller_party',
    COALESCE(public.consignment_org_party(it.auction_org_id, it.organization_id), '{}'::jsonb),
    public.sale_asset_snapshot(_lot_id),
    st.winning_amount, v_deposit, COALESCE(_payee_side, 'org'), COALESCE(_org_signs, false),
    'drafting', v_sign_due, auth.uid())
  RETURNING id INTO v_id;

  -- Một kỳ duy nhất cho phần còn lại, đến hạn đúng mốc bước 6 đã đặt.
  IF st.winning_amount - v_deposit > 0 THEN
    INSERT INTO public.auction_sale_installments (contract_id, seq, label, due_at, amount)
    VALUES (v_id, 1, 'Thanh toán phần còn lại', v_due, st.winning_amount - v_deposit);
  END IF;

  PERFORM public._sale_event(v_id, 'created', 'org', jsonb_build_object(
    'lot_no', it.lot_no, 'price', st.winning_amount, 'deposit_credit', v_deposit,
    'seller_kind', v_seller ->> 'seller_kind'));

  RETURN jsonb_build_object('ok', true, 'id', v_id,
    'code', (SELECT code FROM public.auction_sale_contracts WHERE id = v_id),
    'deposit_credit', v_deposit, 'seller_kind', v_seller ->> 'seller_kind');
END; $$;

-- Sửa điều khoản. Chỉ khi CHƯA ký — ký rồi thì bản giấy là sự thật.
CREATE OR REPLACE FUNCTION public.sale_contract_set_terms(
  _contract_id UUID,
  _installments JSONB DEFAULT NULL,
  _handover_due_at TIMESTAMPTZ DEFAULT NULL,
  _payee_side TEXT DEFAULT NULL,
  _payee_bank_info TEXT DEFAULT NULL,
  _notarization_required BOOLEAN DEFAULT NULL,
  _contract_no TEXT DEFAULT NULL,
  _sign_due_at TIMESTAMPTZ DEFAULT NULL,
  _org_signs BOOLEAN DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.auction_sale_contracts; v_sum NUMERIC := 0; r JSONB; v_seq INT := 0; v_target NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.can_manage_sale_contracts(c.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status IN ('signed','completed','cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF _payee_side IS NOT NULL AND _payee_side NOT IN ('seller','org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payee');
  END IF;

  IF _installments IS NOT NULL THEN
    -- Thay cả bộ kỳ hạn = XOÁ dòng cũ; dòng thu trỏ vào kỳ bằng FK RESTRICT nên
    -- có tiền trong sổ là không đổi lịch được nữa. Tiền có thể vào TRƯỚC khi ký
    -- (đặt cọc chuyển sớm) nên đây là nhánh thật, không phải phòng xa.
    IF EXISTS (SELECT 1 FROM public.auction_sale_payments p WHERE p.contract_id = _contract_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'payments_exist');
    END IF;
    IF jsonb_typeof(_installments) <> 'array' OR jsonb_array_length(_installments) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_installment');
    END IF;
    FOR r IN SELECT * FROM jsonb_array_elements(_installments) LOOP
      IF (r ->> 'amount') IS NULL OR (r ->> 'amount')::numeric <= 0
         OR (r ->> 'amount')::numeric <> trunc((r ->> 'amount')::numeric) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_installment');
      END IF;
      v_sum := v_sum + (r ->> 'amount')::numeric;
    END LOOP;
    v_target := c.price - c.deposit_credit;
    IF v_sum <> v_target THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'installments_mismatch',
        'expected', v_target, 'got', v_sum);
    END IF;

    -- Thay cả BỘ. An toàn vì chưa ký ⇒ chưa thể có dòng thu nào trỏ vào kỳ.
    DELETE FROM public.auction_sale_installments WHERE contract_id = _contract_id;
    FOR r IN SELECT * FROM jsonb_array_elements(_installments) LOOP
      v_seq := v_seq + 1;
      INSERT INTO public.auction_sale_installments (contract_id, seq, label, due_at, amount)
      VALUES (_contract_id, v_seq,
              NULLIF(btrim(COALESCE(r ->> 'label', '')), ''),
              NULLIF(r ->> 'due_at', '')::timestamptz,
              (r ->> 'amount')::numeric);
    END LOOP;
  END IF;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET handover_due_at       = COALESCE(_handover_due_at, handover_due_at),
         payee_side            = COALESCE(_payee_side, payee_side),
         payee_bank_info       = COALESCE(NULLIF(btrim(COALESCE(_payee_bank_info, '')), ''), payee_bank_info),
         notarization_required = COALESCE(_notarization_required, notarization_required),
         contract_no           = COALESCE(NULLIF(btrim(COALESCE(_contract_no, '')), ''), contract_no),
         sign_due_at           = COALESCE(_sign_due_at, sign_due_at),
         org_signs             = COALESCE(_org_signs, org_signs)
   WHERE id = _contract_id;
  PERFORM public._sale_ctx_clear();

  PERFORM public._sale_reallocate(_contract_id);
  PERFORM public._sale_event(_contract_id, 'terms_updated', 'org',
    jsonb_build_object('installments', COALESCE(jsonb_array_length(_installments), 0)));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Chia sẻ dự thảo. Làm mới bản chiếu các bên (hợp đồng chưa ký nên vẫn sống)
-- và XOÁ bản đã ký cùng mọi xác nhận — đổi giấy thì phải ký lại.
CREATE OR REPLACE FUNCTION public.sale_contract_share_draft(
  _contract_id UUID, _draft_doc_path TEXT, _generated BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.auction_sale_contracts; v_err TEXT; v_seller JSONB; v_cleared BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.can_manage_sale_contracts(c.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status NOT IN ('drafting','awaiting_signatures','awaiting_confirmation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  v_err := public.sale_contract_file_check(c.organization_id, c.id, _draft_doc_path, 'draft');
  IF v_err IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', v_err); END IF;

  v_seller  := public.sale_seller_snapshot(c.lot_id);
  v_cleared := c.signed_doc_path IS NOT NULL;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET draft_doc_path    = _draft_doc_path,
         draft_source      = CASE WHEN COALESCE(_generated, false) THEN 'generated' ELSE 'uploaded' END,
         draft_uploaded_by = auth.uid(),
         draft_uploaded_at = clock_timestamp(),
         buyer_party    = public.sale_buyer_snapshot(c.buyer_contract_id),
         seller_party   = COALESCE(v_seller -> 'seller_party', c.seller_party),
         org_party      = COALESCE(public.consignment_org_party(c.auction_org_id, c.organization_id), c.org_party),
         asset_snapshot = public.sale_asset_snapshot(c.lot_id),
         signed_doc_path = NULL, signed_uploaded_side = NULL, signed_uploaded_by = NULL,
         signed_uploaded_at = NULL, signed_date = NULL,
         buyer_confirmed_at = NULL, buyer_confirmed_by = NULL,
         seller_confirmed_at = NULL, seller_confirmed_by = NULL,
         org_confirmed_at = NULL, org_confirmed_by = NULL, signed_at = NULL,
         status = 'awaiting_signatures'
   WHERE id = _contract_id;
  PERFORM public._sale_ctx_clear();

  PERFORM public._sale_event(_contract_id, 'draft_shared', 'org',
    jsonb_build_object('generated', COALESCE(_generated, false), 'cleared_signed', v_cleared));
  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_signatures', 'cleared_signed', v_cleared);
END; $$;

-- Tải bản scan đã ký. Bên nào giữ bản giấy cũng tải được; mọi xác nhận cũ bị
-- xoá vì tệp vừa đổi.
CREATE OR REPLACE FUNCTION public.sale_contract_attach_signed(
  _contract_id UUID, _side TEXT, _signed_doc_path TEXT, _signed_date DATE,
  _contract_no TEXT DEFAULT NULL, _confirm BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.auction_sale_contracts; v_err TEXT; v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF _side NOT IN ('buyer','seller','org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;
  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.sale_can_act(_contract_id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status NOT IN ('drafting','awaiting_signatures','awaiting_confirmation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF _signed_date IS NULL OR _signed_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_signed_date');
  END IF;

  v_err := public.sale_contract_file_check(c.organization_id, c.id, _signed_doc_path, 'signed');
  IF v_err IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', v_err); END IF;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET signed_doc_path      = _signed_doc_path,
         signed_uploaded_side = _side,
         signed_uploaded_by   = auth.uid(),
         signed_uploaded_at   = v_now,
         signed_date          = _signed_date,
         contract_no          = COALESCE(NULLIF(btrim(COALESCE(_contract_no, '')), ''), contract_no),
         buyer_confirmed_at  = CASE WHEN _side = 'buyer'  AND COALESCE(_confirm, false) THEN v_now END,
         buyer_confirmed_by  = CASE WHEN _side = 'buyer'  AND COALESCE(_confirm, false) THEN auth.uid() END,
         seller_confirmed_at = CASE WHEN _side = 'seller' AND COALESCE(_confirm, false) THEN v_now END,
         seller_confirmed_by = CASE WHEN _side = 'seller' AND COALESCE(_confirm, false) THEN auth.uid() END,
         org_confirmed_at    = CASE WHEN _side = 'org'    AND COALESCE(_confirm, false) THEN v_now END,
         org_confirmed_by    = CASE WHEN _side = 'org'    AND COALESCE(_confirm, false) THEN auth.uid() END,
         signed_at = NULL,
         status = 'awaiting_confirmation'
   WHERE id = _contract_id;
  PERFORM public._sale_ctx_clear();

  PERFORM public._sale_event(_contract_id, 'signed_uploaded', _side,
    jsonb_build_object('signed_date', _signed_date, 'self_confirmed', COALESCE(_confirm, false)));
  IF COALESCE(_confirm, false) THEN
    PERFORM public._sale_event(_contract_id, 'confirmed', _side, '{}'::jsonb);
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_confirmation');
END; $$;

-- Xác nhận bản đã ký. Client gửi lại ĐÚNG đường dẫn nó đang hiển thị để server
-- bắt được trường hợp tệp vừa bị thay bằng bản khác.
CREATE OR REPLACE FUNCTION public.sale_contract_confirm(
  _contract_id UUID, _side TEXT, _signed_doc_path TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.auction_sale_contracts; v_now TIMESTAMPTZ := clock_timestamp(); v_all BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF _side NOT IN ('buyer','seller','org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;
  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.sale_can_act(_contract_id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status <> 'awaiting_confirmation' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF _signed_doc_path IS DISTINCT FROM c.signed_doc_path THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'document_changed');
  END IF;
  IF (_side = 'buyer'  AND c.buyer_confirmed_at  IS NOT NULL)
  OR (_side = 'seller' AND c.seller_confirmed_at IS NOT NULL)
  OR (_side = 'org'    AND c.org_confirmed_at    IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_confirmed');
  END IF;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET buyer_confirmed_at  = CASE WHEN _side = 'buyer'  THEN v_now     ELSE buyer_confirmed_at  END,
         buyer_confirmed_by  = CASE WHEN _side = 'buyer'  THEN auth.uid() ELSE buyer_confirmed_by  END,
         seller_confirmed_at = CASE WHEN _side = 'seller' THEN v_now     ELSE seller_confirmed_at END,
         seller_confirmed_by = CASE WHEN _side = 'seller' THEN auth.uid() ELSE seller_confirmed_by END,
         org_confirmed_at    = CASE WHEN _side = 'org'    THEN v_now     ELSE org_confirmed_at    END,
         org_confirmed_by    = CASE WHEN _side = 'org'    THEN auth.uid() ELSE org_confirmed_by    END
   WHERE id = _contract_id
  RETURNING (buyer_confirmed_at IS NOT NULL AND seller_confirmed_at IS NOT NULL
             AND (NOT org_signs OR org_confirmed_at IS NOT NULL)) INTO v_all;

  IF v_all THEN
    UPDATE public.auction_sale_contracts
       SET status = 'signed', signed_at = v_now,
           handover_due_at = COALESCE(handover_due_at, v_now + interval '7 days')
     WHERE id = _contract_id;
  END IF;
  PERFORM public._sale_ctx_clear();

  PERFORM public._sale_event(_contract_id, 'confirmed', _side, '{}'::jsonb);
  IF v_all THEN
    PERFORM public._sale_event(_contract_id, 'signed', NULL, jsonb_build_object('signed_at', v_now));
    -- Tiền có thể đã vào sổ trước khi ký (đặt cọc thường chuyển sớm) ⇒ chốt lại.
    PERFORM public._sale_settle(_contract_id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN v_all THEN 'signed' ELSE 'awaiting_confirmation' END);
END; $$;

-- Huỷ hợp đồng. Hậu quả tiền đặt trước theo LOẠI huỷ — đúng ngữ nghĩa bước 6,
-- không mở thêm một nhánh mã thứ hai cho cùng việc.
--   buyer_refused  → cọc MẤT + lô `defaulted`      (Điều 39 Luật ĐGTS)
--   seller_refused → cọc chờ hoàn
--   mutual         → cọc chờ hoàn
-- Huỷ một hợp đồng ĐÃ KÝ là hợp lệ (hai bên thoả thuận) — chỉ đòi lý do rõ.
CREATE OR REPLACE FUNCTION public.sale_contract_cancel(
  _contract_id UUID, _side TEXT, _kind TEXT, _reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.auction_sale_contracts; it RECORD;
  v_reason TEXT := btrim(COALESCE(_reason, ''));
  v_now TIMESTAMPTZ := clock_timestamp();
  v_forfeit BOOLEAN := false; v_refund BOOLEAN := false; v_deposit_to TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF _side NOT IN ('buyer','seller','org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;
  IF _kind NOT IN ('buyer_refused','seller_refused','mutual') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;
  IF char_length(v_reason) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.sale_can_act(_contract_id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status = 'cancelled' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_cancelled'); END IF;
  IF c.status = 'completed' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_completed'); END IF;

  SELECT i.lot_no, i.session_id INTO it FROM public.auction_session_items i WHERE i.id = c.lot_id;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET status = 'cancelled', cancelled_at = v_now, cancelled_by = auth.uid(),
         cancelled_side = _side, cancel_kind = _kind, cancel_reason = v_reason,
         paid_at = NULL
   WHERE id = _contract_id;
  PERFORM public._sale_ctx_clear();

  IF _kind = 'buyer_refused' THEN
    v_deposit_to := 'forfeited';
    PERFORM public._bidding_ctx(
      'Người trúng đấu giá từ chối ký hợp đồng mua bán lô ' || COALESCE(it.lot_no::text, '?'), c.lot_id);
    UPDATE public.auction_bidding_contracts
       SET deposit_status = 'forfeited', deposit_status_changed_at = v_now, deposit_updated_by = auth.uid()
     WHERE id = c.buyer_contract_id AND deposit_status = 'applied';
    v_forfeit := FOUND;
    PERFORM public._bidding_ctx_clear();

    UPDATE public.auction_lot_states
       SET payment_status = 'defaulted', payment_confirmed_at = v_now
     WHERE lot_id = c.lot_id AND payment_status IN ('pending','paid');
    PERFORM public._lot_event(it.session_id, c.lot_id, 'payment', jsonb_build_object(
      'paid', false, 'source', 'sale_contract_cancel', 'sale_contract_id', c.id,
      'deposit_forfeited', v_forfeit));
  ELSE
    v_deposit_to := 'pending_refund';
    PERFORM public._bidding_ctx(
      CASE WHEN _kind = 'seller_refused'
           THEN 'Bên bán từ chối ký hợp đồng mua bán — hoàn tiền đặt trước'
           ELSE 'Hai bên thoả thuận huỷ hợp đồng mua bán — hoàn tiền đặt trước' END, c.lot_id);
    UPDATE public.auction_bidding_contracts
       SET deposit_status = 'pending_refund', deposit_status_changed_at = v_now, deposit_updated_by = auth.uid()
     WHERE id = c.buyer_contract_id AND deposit_status = 'applied';
    v_refund := FOUND;
    PERFORM public._bidding_ctx_clear();

    -- Lô không còn người mua: về `pending` để tổ chức xử lý tiếp bằng công cụ cũ.
    UPDATE public.auction_lot_states
       SET payment_status = 'pending', payment_confirmed_at = NULL
     WHERE lot_id = c.lot_id AND payment_status = 'paid';
  END IF;

  PERFORM public._sale_event(_contract_id, 'cancelled', _side, jsonb_build_object(
    'kind', _kind, 'reason', v_reason, 'deposit', v_deposit_to,
    'deposit_forfeited', v_forfeit, 'deposit_pending_refund', v_refund));
  RETURN jsonb_build_object('ok', true, 'status', 'cancelled', 'cancel_kind', _kind,
    'deposit_forfeited', v_forfeit, 'deposit_pending_refund', v_refund);
END; $$;

-- Ghi một lần thu. CHỈ tổ chức — họ là bên đang thu tiền và đã vận hành tiền
-- đặt trước; để hai bên cùng ghi là mở đường cho hai nguồn sự thật.
CREATE OR REPLACE FUNCTION public.org_record_sale_payment(
  _contract_id UUID, _amount NUMERIC, _method TEXT,
  _txn_ref TEXT DEFAULT NULL, _received_at TIMESTAMPTZ DEFAULT NULL,
  _evidence_path TEXT DEFAULT NULL, _note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.auction_sale_contracts; v_bal NUMERIC; v_pay_id UUID;
  v_inst UUID; v_full BOOLEAN; v_err TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF _method NOT IN ('bank_transfer','cash','vnpay_mock','other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_method');
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount <> trunc(_amount) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.can_manage_sale_contracts(c.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status IN ('cancelled','completed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cancelled');
  END IF;

  v_bal := public.sale_balance(_contract_id);
  IF _amount > v_bal THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_exceeds_balance', 'balance', v_bal);
  END IF;

  IF _evidence_path IS NOT NULL THEN
    v_err := public.sale_contract_file_check(c.organization_id, c.id, _evidence_path, 'receipt');
    IF v_err IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', v_err); END IF;
  END IF;

  -- Kỳ đầu tiên còn thiếu tiền — chỉ để hiển thị; phân bổ thật do FIFO lo.
  SELECT id INTO v_inst FROM public.auction_sale_installments
   WHERE contract_id = _contract_id AND paid_amount < amount ORDER BY seq LIMIT 1;

  INSERT INTO public.auction_sale_payments (
    contract_id, installment_id, amount, method, txn_ref, received_at, evidence_path, note, recorded_by)
  VALUES (_contract_id, v_inst, _amount, _method,
          NULLIF(btrim(COALESCE(_txn_ref, '')), ''), COALESCE(_received_at, clock_timestamp()),
          _evidence_path, NULLIF(btrim(COALESCE(_note, '')), ''), auth.uid())
  RETURNING id INTO v_pay_id;

  v_full := public._sale_settle(_contract_id);
  PERFORM public._sale_event(_contract_id, 'payment', 'org', jsonb_build_object(
    'payment_id', v_pay_id, 'amount', _amount, 'method', _method,
    'balance', public.sale_balance(_contract_id), 'settled', v_full));
  IF v_full THEN PERFORM public._sale_maybe_complete(_contract_id); END IF;

  RETURN jsonb_build_object('ok', true, 'payment_id', v_pay_id,
    'balance', public.sale_balance(_contract_id), 'settled', v_full);
END; $$;

-- Hoàn một dòng thu = ghi thêm MỘT dòng đối ứng. Không bao giờ sửa dòng cũ.
CREATE OR REPLACE FUNCTION public.org_reverse_sale_payment(_payment_id UUID, _reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.auction_sale_payments; c public.auction_sale_contracts;
  v_reason TEXT := btrim(COALESCE(_reason, '')); v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF char_length(v_reason) < 5 THEN RETURN jsonb_build_object('ok', false, 'reason', 'reason_required'); END IF;

  SELECT * INTO p FROM public.auction_sale_payments WHERE id = _payment_id;
  IF p.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF p.reversed_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_target');
  END IF;

  PERFORM public._sale_lock(p.contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = p.contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.can_manage_sale_contracts(c.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status = 'cancelled' THEN RETURN jsonb_build_object('ok', false, 'reason', 'cancelled'); END IF;
  IF EXISTS (SELECT 1 FROM public.auction_sale_payments r WHERE r.reversed_payment_id = _payment_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_reversed');
  END IF;

  INSERT INTO public.auction_sale_payments (
    contract_id, installment_id, amount, method, received_at,
    reversed_payment_id, reversal_reason, recorded_by)
  VALUES (p.contract_id, p.installment_id, p.amount, p.method, clock_timestamp(),
          _payment_id, v_reason, auth.uid())
  RETURNING id INTO v_id;

  PERFORM public._sale_settle(p.contract_id);
  PERFORM public._sale_event(p.contract_id, 'payment_reversed', 'org', jsonb_build_object(
    'payment_id', _payment_id, 'reversal_id', v_id, 'amount', p.amount, 'reason', v_reason,
    'balance', public.sale_balance(p.contract_id)));
  RETURN jsonb_build_object('ok', true, 'reversal_id', v_id, 'balance', public.sale_balance(p.contract_id));
END; $$;

-- Hẹn lịch bàn giao (tổ chức). Chỉ sau khi hợp đồng đã ký.
CREATE OR REPLACE FUNCTION public.sale_contract_schedule_handover(
  _contract_id UUID, _handover_at TIMESTAMPTZ, _location TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.auction_sale_contracts;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.can_manage_sale_contracts(c.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status <> 'signed' THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status'); END IF;
  IF _handover_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_schedule'); END IF;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET handover_scheduled_at = _handover_at,
         handover_location = NULLIF(btrim(COALESCE(_location, '')), '')
   WHERE id = _contract_id;
  PERFORM public._sale_ctx_clear();

  PERFORM public._sale_event(_contract_id, 'handover_scheduled', 'org',
    jsonb_build_object('at', _handover_at, 'location', _location));
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Xác nhận đã bàn giao. HAI bên phải cùng xác nhận; biên bản scan tuỳ chọn.
CREATE OR REPLACE FUNCTION public.sale_contract_confirm_handover(
  _contract_id UUID, _side TEXT, _doc_path TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.auction_sale_contracts; v_now TIMESTAMPTZ := clock_timestamp();
  v_both BOOLEAN; v_err TEXT; v_done BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF _side NOT IN ('buyer','seller') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;
  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.sale_can_act(_contract_id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status <> 'signed' THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status'); END IF;
  IF (_side = 'buyer'  AND c.handover_buyer_confirmed_at  IS NOT NULL)
  OR (_side = 'seller' AND c.handover_seller_confirmed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_confirmed');
  END IF;

  IF _doc_path IS NOT NULL THEN
    v_err := public.sale_contract_file_check(c.organization_id, c.id, _doc_path, 'handover');
    IF v_err IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', v_err); END IF;
  END IF;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET handover_buyer_confirmed_at  = CASE WHEN _side = 'buyer'  THEN v_now      ELSE handover_buyer_confirmed_at  END,
         handover_buyer_confirmed_by  = CASE WHEN _side = 'buyer'  THEN auth.uid() ELSE handover_buyer_confirmed_by  END,
         handover_seller_confirmed_at = CASE WHEN _side = 'seller' THEN v_now      ELSE handover_seller_confirmed_at END,
         handover_seller_confirmed_by = CASE WHEN _side = 'seller' THEN auth.uid() ELSE handover_seller_confirmed_by END,
         handover_doc_path = COALESCE(_doc_path, handover_doc_path)
   WHERE id = _contract_id
  RETURNING (handover_buyer_confirmed_at IS NOT NULL AND handover_seller_confirmed_at IS NOT NULL) INTO v_both;

  IF v_both THEN
    UPDATE public.auction_sale_contracts SET handed_over_at = COALESCE(handed_over_at, v_now)
     WHERE id = _contract_id;
  END IF;
  PERFORM public._sale_ctx_clear();

  PERFORM public._sale_event(_contract_id, 'handover_confirmed', _side, '{}'::jsonb);
  IF v_both THEN
    PERFORM public._sale_event(_contract_id, 'handed_over', NULL, jsonb_build_object('at', v_now));
    v_done := public._sale_maybe_complete(_contract_id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'handed_over', COALESCE(v_both, false), 'completed', v_done);
END; $$;

-- Đăng ký sang tên chỉ là GHI NHẬN: thủ tục diễn ra ở cơ quan nhà nước, sàn
-- không có quy trình nào để chạy ở đây.
CREATE OR REPLACE FUNCTION public.sale_contract_set_title_transfer(
  _contract_id UUID, _status TEXT, _note TEXT DEFAULT NULL, _doc_path TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.auction_sale_contracts; v_err TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF _status NOT IN ('not_required','pending','submitted','completed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  PERFORM public._sale_lock(_contract_id);
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id FOR UPDATE;
  IF c.id IS NULL OR NOT public.can_manage_sale_contracts(c.organization_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status = 'cancelled' THEN RETURN jsonb_build_object('ok', false, 'reason', 'cancelled'); END IF;

  IF _doc_path IS NOT NULL THEN
    v_err := public.sale_contract_file_check(c.organization_id, c.id, _doc_path, 'title');
    IF v_err IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', v_err); END IF;
  END IF;

  PERFORM public._sale_ctx();
  UPDATE public.auction_sale_contracts
     SET title_transfer_status   = _status,
         title_transfer_note     = NULLIF(btrim(COALESCE(_note, '')), ''),
         title_transfer_doc_path = COALESCE(_doc_path, title_transfer_doc_path)
   WHERE id = _contract_id;
  PERFORM public._sale_ctx_clear();

  PERFORM public._sale_event(_contract_id, 'title_transfer', 'org',
    jsonb_build_object('status', _status, 'note', _note));
  RETURN jsonb_build_object('ok', true, 'title_transfer_status', _status);
END; $$;

-- Giai đoạn suy ra từ dòng dữ liệu. Bản TS `saleStageOf` soi gương hàm này —
-- sửa luật thì sửa CẢ HAI.
CREATE OR REPLACE FUNCTION public.sale_contract_stage(_c public.auction_sale_contracts) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _c.status = 'cancelled' THEN 'cancelled'
    WHEN _c.status = 'completed' THEN 'completed'
    WHEN _c.status <> 'signed'   THEN 'signing'
    WHEN _c.paid_at IS NULL      THEN 'paying'
    WHEN _c.handed_over_at IS NULL THEN 'handover'
    ELSE 'completed' END
$$;
REVOKE ALL ON FUNCTION public.sale_contract_stage(public.auction_sale_contracts) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sale_contract_stage(public.auction_sale_contracts) TO authenticated;

-- Một vòng gọi cho cả trang chi tiết: hợp đồng + kỳ hạn + sổ tiền + nhật ký +
-- quyền của người đang xem. Hai bên thấy NHAU ĐẦY ĐỦ — đó là bản chất hợp đồng.
CREATE OR REPLACE FUNCTION public.sale_contract_detail(_contract_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.auction_sale_contracts; v_bal NUMERIC;
BEGIN
  SELECT * INTO c FROM public.auction_sale_contracts WHERE id = _contract_id;
  IF c.id IS NULL OR NOT public.sale_contract_visible(_contract_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  v_bal := public.sale_balance(_contract_id);

  RETURN jsonb_build_object(
    'ok', true,
    'contract', to_jsonb(c),
    'stage', public.sale_contract_stage(c),
    'balance', v_bal,
    'net_paid', public.sale_net_paid(_contract_id),
    'installments', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.seq)
                                FROM public.auction_sale_installments i
                               WHERE i.contract_id = _contract_id), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.at)
                            FROM public.auction_sale_payments p
                           WHERE p.contract_id = _contract_id), '[]'::jsonb),
    'events', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.at)
                          FROM public.auction_sale_contract_events e
                         WHERE e.contract_id = _contract_id), '[]'::jsonb),
    'can_act', jsonb_build_object(
      'buyer',  public.sale_can_act(_contract_id, 'buyer'),
      'seller', public.sale_can_act(_contract_id, 'seller'),
      'org',    public.sale_can_act(_contract_id, 'org')));
END; $$;

-- Huy hiệu điều hướng của tổ chức.
CREATE OR REPLACE FUNCTION public.org_sale_contract_counts(_organization_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action INT; v_overdue INT; v_open INT; v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT public.can_manage_sale_contracts(_organization_id, 'view') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT
    count(*) FILTER (WHERE c.status NOT IN ('completed','cancelled')),
    count(*) FILTER (WHERE c.status NOT IN ('completed','cancelled') AND (
        c.status = 'drafting'
     OR (c.status = 'awaiting_confirmation' AND (
            (c.org_signs AND c.org_confirmed_at IS NULL)
         OR (c.seller_kind = 'org_on_behalf' AND c.seller_confirmed_at IS NULL)))
     OR (c.status = 'signed' AND c.paid_at IS NOT NULL AND c.handed_over_at IS NULL
         AND c.handover_scheduled_at IS NULL))),
    count(*) FILTER (WHERE c.status NOT IN ('completed','cancelled') AND (
        (c.status <> 'signed' AND c.sign_due_at IS NOT NULL AND c.sign_due_at < v_now)
     OR (c.status = 'signed' AND c.paid_at IS NULL AND EXISTS (
            SELECT 1 FROM public.auction_sale_installments i
             WHERE i.contract_id = c.id AND i.due_at < v_now AND i.paid_amount < i.amount))
     OR (c.paid_at IS NOT NULL AND c.handed_over_at IS NULL
         AND c.handover_due_at IS NOT NULL AND c.handover_due_at < v_now)))
    INTO v_open, v_action, v_overdue
  FROM public.auction_sale_contracts c
  WHERE c.organization_id = _organization_id;

  RETURN jsonb_build_object('open', COALESCE(v_open, 0),
                            'action_needed', COALESCE(v_action, 0),
                            'overdue', COALESCE(v_overdue, 0));
END; $$;

-- Cổng chủ tài sản: SECURITY INVOKER là đủ vì RLS đã giới hạn đúng dòng của họ.
CREATE OR REPLACE FUNCTION public.owner_sale_contract_summary()
RETURNS TABLE (contract_id UUID, code TEXT, status TEXT, stage TEXT, owner_action TEXT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT c.id, c.code, c.status, public.sale_contract_stage(c),
         CASE
           WHEN c.status = 'awaiting_confirmation' AND c.seller_confirmed_at IS NULL THEN 'confirm_signed'
           WHEN c.status = 'signed' AND c.paid_at IS NOT NULL
                AND c.handover_seller_confirmed_at IS NULL THEN 'confirm_handover'
           ELSE 'none' END
  FROM public.auction_sale_contracts c
  WHERE c.seller_kind = 'owner_user' AND c.seller_user_id = auth.uid()
$$;

-- ─── 7b. Cấp quyền gọi RPC ──────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.org_create_sale_contract(UUID, TEXT, BOOLEAN, TIMESTAMPTZ)                                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_set_terms(UUID, JSONB, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_share_draft(UUID, TEXT, BOOLEAN)                                                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_attach_signed(UUID, TEXT, TEXT, DATE, TEXT, BOOLEAN)                                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_confirm(UUID, TEXT, TEXT)                                                            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_cancel(UUID, TEXT, TEXT, TEXT)                                                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_record_sale_payment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_reverse_sale_payment(UUID, TEXT)                                                               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_schedule_handover(UUID, TIMESTAMPTZ, TEXT)                                           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_confirm_handover(UUID, TEXT, TEXT)                                                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_set_title_transfer(UUID, TEXT, TEXT, TEXT)                                           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_contract_detail(UUID)                                                                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.org_sale_contract_counts(UUID)                                                                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_sale_contract_summary()                                                                      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.org_create_sale_contract(UUID, TEXT, BOOLEAN, TIMESTAMPTZ)                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_set_terms(UUID, JSONB, TIMESTAMPTZ, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_share_draft(UUID, TEXT, BOOLEAN)                                                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_attach_signed(UUID, TEXT, TEXT, DATE, TEXT, BOOLEAN)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_confirm(UUID, TEXT, TEXT)                                                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_cancel(UUID, TEXT, TEXT, TEXT)                                                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_record_sale_payment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_reverse_sale_payment(UUID, TEXT)                                                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_schedule_handover(UUID, TIMESTAMPTZ, TEXT)                                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_confirm_handover(UUID, TEXT, TEXT)                                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_set_title_transfer(UUID, TEXT, TEXT, TEXT)                                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_contract_detail(UUID)                                                                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_sale_contract_counts(UUID)                                                                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_sale_contract_summary()                                                                      TO authenticated;

-- ─── 8. Mã quyền tổ chức `hop-dong-mua-ban` ─────────────────────────────────
-- HAI phần, thiếu phần nào cũng sai: (1) vá các tổ chức ĐANG CÓ, (2) chép cả
-- preset sang bản mới của org_seed_default_roles cho tổ chức SẼ tạo.
-- Backfill CẢ MANAGER lẫn AGENT (bài học 20260906100002). OWNER không cần dòng.

INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT r.id, 'hop-dong-mua-ban', v.action
FROM public.org_roles r
JOIN (VALUES
  ('MANAGER', 'view'), ('MANAGER', 'update'),
  ('AGENT',   'view')
) AS v(code, action) ON v.code = r.code
ON CONFLICT (role_id, module, action) DO NOTHING;

CREATE OR REPLACE FUNCTION public.org_seed_default_roles(_org_id UUID) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner_role_id UUID;
BEGIN
  INSERT INTO public.org_roles (organization_id, name, code, description, is_system)
  VALUES (_org_id, 'Chủ sở hữu', 'OWNER', 'Toàn quyền trong tổ chức. Không thể xóa.', true)
  ON CONFLICT (organization_id, code) DO UPDATE SET updated_at = now()
  RETURNING id INTO _owner_role_id;

  INSERT INTO public.org_roles (organization_id, name, code, description, is_system) VALUES
    (_org_id, 'Quản lý',   'MANAGER', 'Quản lý hồ sơ năng lực, hồ sơ dự tuyển và thành viên.', false),
    (_org_id, 'Nhân viên', 'AGENT',   'Xem hồ sơ và lập hồ sơ dự tuyển.', false)
  ON CONFLICT (organization_id, code) DO NOTHING;

  INSERT INTO public.org_role_permissions (role_id, module, action)
  SELECT r.id, v.module, v.action
  FROM public.org_roles r
  JOIN (VALUES
    ('MANAGER','tong-quan','view'),
    ('MANAGER','nl-thong-tin-chung','view'),   ('MANAGER','nl-thong-tin-chung','update'),
    ('MANAGER','nl-dau-gia-vien','view'),      ('MANAGER','nl-dau-gia-vien','create'),
    ('MANAGER','nl-dau-gia-vien','update'),    ('MANAGER','nl-dau-gia-vien','delete'),
    ('MANAGER','nhan-su','view'),              ('MANAGER','nhan-su','update'),
    ('MANAGER','nhan-su','export'),
    ('MANAGER','boi-duong','view'),            ('MANAGER','boi-duong','create'),
    ('MANAGER','boi-duong','update'),          ('MANAGER','boi-duong','delete'),
    ('MANAGER','boi-duong','export'),
    ('MANAGER','nl-co-so-vat-chat','view'),    ('MANAGER','nl-co-so-vat-chat','create'),
    ('MANAGER','nl-co-so-vat-chat','update'),  ('MANAGER','nl-co-so-vat-chat','delete'),
    ('MANAGER','nl-lich-su-dau-gia','view'),   ('MANAGER','nl-lich-su-dau-gia','create'),
    ('MANAGER','nl-lich-su-dau-gia','update'), ('MANAGER','nl-lich-su-dau-gia','delete'),
    ('MANAGER','nl-lich-su-dau-gia','export'),
    ('MANAGER','nl-tai-chinh','view'),         ('MANAGER','nl-tai-chinh','update'),
    ('MANAGER','ho-so-du-tuyen','view'),       ('MANAGER','ho-so-du-tuyen','create'),
    ('MANAGER','ho-so-du-tuyen','update'),     ('MANAGER','ho-so-du-tuyen','delete'),
    ('MANAGER','ho-so-du-tuyen','export'),
    ('MANAGER','yeu-cau-ky-gui','view'),       ('MANAGER','yeu-cau-ky-gui','update'),
    ('MANAGER','phien-dau-gia','view'),        ('MANAGER','phien-dau-gia','create'),
    ('MANAGER','phien-dau-gia','update'),      ('MANAGER','phien-dau-gia','delete'),
    ('MANAGER','ho-so-tham-gia','view'),       ('MANAGER','ho-so-tham-gia','update'),
    ('MANAGER','dieu-hanh-dau-gia','view'),    ('MANAGER','dieu-hanh-dau-gia','operate'),
    ('MANAGER','dieu-hanh-dau-gia','finalize'),
    ('MANAGER','hop-dong-mua-ban','view'),     ('MANAGER','hop-dong-mua-ban','update'),
    ('MANAGER','hoi-dap','view'),              ('MANAGER','hoi-dap','update'),
    ('MANAGER','hoi-dap-cai-dat','update'),
    ('MANAGER','tin-dang','view'),             ('MANAGER','tin-dang','create'),
    ('MANAGER','tin-dang','update'),           ('MANAGER','tin-dang','delete'),
    ('MANAGER','thanh-vien','view'),           ('MANAGER','thanh-vien','create'),
    ('MANAGER','credit','view'),
    ('AGENT','tong-quan','view'),
    ('AGENT','nl-thong-tin-chung','view'),     ('AGENT','nl-dau-gia-vien','view'),
    ('AGENT','nhan-su','view'),                ('AGENT','nhan-su','export'),
    ('AGENT','boi-duong','view'),              ('AGENT','boi-duong','export'),
    ('AGENT','nl-co-so-vat-chat','view'),      ('AGENT','nl-lich-su-dau-gia','view'),
    ('AGENT','nl-tai-chinh','view'),
    ('AGENT','ho-so-du-tuyen','view'),         ('AGENT','ho-so-du-tuyen','create'),
    ('AGENT','yeu-cau-ky-gui','view'),
    ('AGENT','phien-dau-gia','view'),
    ('AGENT','ho-so-tham-gia','view'),
    ('AGENT','dieu-hanh-dau-gia','view'),
    ('AGENT','hop-dong-mua-ban','view'),
    ('AGENT','hoi-dap','view'),                ('AGENT','hoi-dap','update'),
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;

-- ─── 8b. Chặn hai người cùng ghi `payment_status` ────────────────────────────
-- Sổ tiền và nút "Đã thanh toán" của bước 6 ghi CÙNG một cột. UI ẩn nút cũ khi
-- đã có hợp đồng, nhưng ẩn nút không phải là bảo vệ — chốt luôn ở server.
-- Giữ NGUYÊN chữ ký ⇒ CREATE OR REPLACE, không DROP, quyền cũ còn nguyên.
CREATE OR REPLACE FUNCTION public.org_confirm_winner_payment(_lot_id UUID, _paid BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it        RECORD;
  st        public.auction_lot_states;
  v_now     TIMESTAMPTZ;
  v_forfeit BOOLEAN := false;
BEGIN
  SELECT i.id, i.lot_no, i.session_id, s.organization_id, s.finalized_at
    INTO it
    FROM public.auction_session_items i JOIN public.auction_sessions s ON s.id = i.session_id
   WHERE i.id = _lot_id;
  IF it.id IS NULL OR NOT public.can_run_auction(it.organization_id, 'finalize') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF it.finalized_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_finalized');
  END IF;
  IF _paid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  -- MỚI (20260914000001): lô đã có hợp đồng mua bán thì sổ thanh toán là sự thật.
  IF EXISTS (SELECT 1 FROM public.auction_sale_contracts sc
              WHERE sc.lot_id = _lot_id AND sc.status <> 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sale_contract_exists');
  END IF;

  PERFORM public._lot_lock(_lot_id);
  v_now := clock_timestamp();

  SELECT * INTO st FROM public.auction_lot_states WHERE lot_id = _lot_id FOR UPDATE;
  IF st.result IS DISTINCT FROM 'sold' OR st.payment_status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  UPDATE public.auction_lot_states
     SET payment_status = CASE WHEN _paid THEN 'paid' ELSE 'defaulted' END,
         payment_confirmed_at = v_now
   WHERE lot_id = _lot_id;

  IF NOT _paid THEN
    PERFORM public._bidding_ctx('Người trúng đấu giá không thanh toán lô ' || it.lot_no || ' đúng hạn', _lot_id);
    UPDATE public.auction_bidding_contracts
       SET deposit_status = 'forfeited', deposit_status_changed_at = v_now
     WHERE id = st.winner_contract_id AND deposit_status = 'applied';
    v_forfeit := FOUND;
    PERFORM public._bidding_ctx_clear();
  END IF;

  PERFORM public._lot_event(it.session_id, _lot_id, 'payment', jsonb_build_object(
    'paid', _paid, 'winning_amount', st.winning_amount, 'payment_due_at', st.payment_due_at,
    'deposit_forfeited', v_forfeit));
  RETURN jsonb_build_object('ok', true, 'payment_status', CASE WHEN _paid THEN 'paid' ELSE 'defaulted' END,
                            'deposit_forfeited', v_forfeit);
END; $$;

REVOKE ALL  ON FUNCTION public.org_confirm_winner_payment(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_confirm_winner_payment(UUID, BOOLEAN) TO authenticated;

-- ─── 9. Kiểm chứng ──────────────────────────────────────────────────────────
DO $verify$
DECLARE v_n INT; v_fn TEXT; v_role TEXT;
BEGIN
  -- 9.1 Helper nội bộ không được lọt ra tay client.
  FOR v_fn, v_role IN
    SELECT p.proname, r.rolname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
     WHERE p.proname IN ('_sale_rpc_active','_sale_ctx','_sale_ctx_clear','_sale_lock','_sale_event',
                         '_sale_reallocate','_sale_settle','_sale_maybe_complete',
                         'sale_buyer_snapshot','sale_seller_snapshot','sale_asset_snapshot',
                         'sale_net_paid','sale_balance','sale_path_uuid','sale_contract_file_check')
       AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  LOOP
    RAISE EXCEPTION 'Hàm nội bộ public.% vẫn gọi được bởi %', v_fn, v_role;
  END LOOP;

  -- 9.2 Không RPC ghi nào mở cho khách vãng lai.
  FOR v_fn IN
    SELECT p.proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
     WHERE p.proname IN ('org_create_sale_contract','sale_contract_set_terms','sale_contract_share_draft',
                         'sale_contract_attach_signed','sale_contract_confirm','sale_contract_cancel',
                         'org_record_sale_payment','org_reverse_sale_payment',
                         'sale_contract_schedule_handover','sale_contract_confirm_handover',
                         'sale_contract_set_title_transfer','sale_contract_detail')
       AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    RAISE EXCEPTION 'RPC public.% vẫn gọi được bởi anon', v_fn;
  END LOOP;

  -- 9.3 Mỗi RPC đúng MỘT dòng pg_proc — CREATE OR REPLACE sai chữ ký sẽ đẻ
  --     overload và PostgREST trả PGRST203 lúc chạy, typecheck vẫn xanh.
  FOR v_fn IN
    SELECT p.proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
     WHERE p.proname LIKE 'sale\_contract\_%' OR p.proname LIKE 'org\_%sale\_%'
     GROUP BY p.proname HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION 'Hàm public.% có nhiều hơn một chữ ký (overload)', v_fn;
  END LOOP;

  -- 9.4 Bucket hợp đồng mua bán in CCCD hai bên — TUYỆT ĐỐI không policy anon.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND policyname LIKE 'auction_sale_contract_files%'
     AND 'anon' = ANY (roles);
  IF v_n > 0 THEN RAISE EXCEPTION 'Bucket auction-sale-contracts có % policy cho anon', v_n; END IF;

  SELECT count(*) INTO v_n FROM storage.buckets WHERE id = 'auction-sale-contracts' AND public = false;
  IF v_n <> 1 THEN RAISE EXCEPTION 'Bucket auction-sale-contracts phải tồn tại và PRIVATE'; END IF;

  -- 9.5 Bốn bảng đều bật RLS và KHÔNG có policy ghi.
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relrowsecurity
     AND c.relname IN ('auction_sale_contracts','auction_sale_installments',
                       'auction_sale_payments','auction_sale_contract_events');
  IF v_n <> 4 THEN RAISE EXCEPTION 'Còn bảng hợp đồng mua bán chưa bật RLS (%/4)', v_n; END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND cmd <> 'SELECT'
     AND tablename IN ('auction_sale_contracts','auction_sale_installments',
                       'auction_sale_payments','auction_sale_contract_events');
  IF v_n > 0 THEN RAISE EXCEPTION 'Có % policy GHI trên bảng hợp đồng mua bán — mọi thay đổi phải qua RPC', v_n; END IF;

  -- 9.6 Mã quyền đã vá cho MỌI tổ chức đang có.
  SELECT count(*) INTO v_n FROM public.org_roles r
   WHERE r.code IN ('MANAGER','AGENT')
     AND NOT EXISTS (SELECT 1 FROM public.org_role_permissions p
                      WHERE p.role_id = r.id AND p.module = 'hop-dong-mua-ban');
  IF v_n > 0 THEN RAISE EXCEPTION 'Còn % vai trò chưa có mã quyền hop-dong-mua-ban', v_n; END IF;

  RAISE NOTICE 'OK: hợp đồng mua bán tài sản đấu giá sẵn sàng';
END $verify$;
