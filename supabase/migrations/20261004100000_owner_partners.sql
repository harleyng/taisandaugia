-- Danh bạ "đối tác riêng" của chủ tài sản (thẩm định / pháp lý / tổ chức đấu giá).
--
--  • Mỗi dịch vụ của hồ sơ số hoá (Pháp lý · Đấu giá · Thẩm định) có 2 lựa chọn: "Đối tác riêng"
--    (source = 'external_partner') hoặc "Dịch vụ của sàn" (source = 'marketplace'). Đối tác riêng
--    là ô CHỌN từ danh bạ này; gõ tên mới ⇒ tạo dòng mới (owner_partner_ensure).
--  • Phạm vi: một Trạm (workspace_id) dùng chung cho cả đội, HOẶC chủ cá nhân (user_id) — đúng
--    một trong hai, khớp phạm vi của asset_postings.
--  • Tổ chức đấu giá chọn từ danh bạ công khai ⇒ dòng mang auction_org_id (không trùng trong phạm vi).
--  • asset_posting_dossier_items.partner_id trỏ về đây; trigger đồng bộ CHÉP tên / auction_org_id
--    vào partner_name / partner_org_id để điểm tin cậy + "Đối tác của tôi" (đọc 2 cột đó) không đổi.

CREATE TABLE public.owner_partners (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('appraisal','legal','auction')),
  name           TEXT NOT NULL CHECK (btrim(name) <> ''),
  name_key       TEXT NOT NULL,                       -- partner_name_key(name), do trigger điền
  auction_org_id UUID REFERENCES public.auction_organizations(id) ON DELETE SET NULL,
  created_by     UUID NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owner_partners_one_scope CHECK ((workspace_id IS NULL) <> (user_id IS NULL)),
  CONSTRAINT owner_partners_org_only_auction CHECK (auction_org_id IS NULL OR kind = 'auction')
);

CREATE UNIQUE INDEX owner_partners_ws_name_uq   ON public.owner_partners (workspace_id, kind, name_key) WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX owner_partners_user_name_uq ON public.owner_partners (user_id, kind, name_key)      WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX owner_partners_ws_org_uq    ON public.owner_partners (workspace_id, auction_org_id) WHERE workspace_id IS NOT NULL AND auction_org_id IS NOT NULL;
CREATE UNIQUE INDEX owner_partners_user_org_uq  ON public.owner_partners (user_id, auction_org_id)      WHERE user_id IS NOT NULL AND auction_org_id IS NOT NULL;

-- Tên gọn khoảng trắng + khoá chuẩn hoá; created_by bất biến.
CREATE FUNCTION public.owner_partners_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.name := regexp_replace(btrim(NEW.name), '\s+', ' ', 'g');
  NEW.name_key := public.partner_name_key(NEW.name);
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER owner_partners_normalize
  BEFORE INSERT OR UPDATE ON public.owner_partners
  FOR EACH ROW EXECUTE FUNCTION public.owner_partners_normalize();

ALTER TABLE public.owner_partners ENABLE ROW LEVEL SECURITY;

-- Đọc: thành viên Trạm, hoặc chính chủ cá nhân.
CREATE POLICY owner_partners_read ON public.owner_partners
  FOR SELECT TO authenticated
  USING (CASE WHEN workspace_id IS NOT NULL THEN public.owner_ws_role(workspace_id) IS NOT NULL
              ELSE user_id = auth.uid() END);

-- Thêm: ai được sửa hồ sơ số hoá của Trạm (cùng quyền khai đối tác vào hồ sơ), hoặc chủ cá nhân.
CREATE POLICY owner_partners_insert ON public.owner_partners
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND CASE WHEN workspace_id IS NOT NULL THEN public.owner_ws_has(workspace_id, 'so-hoa', 'update')
                       ELSE user_id = auth.uid() END);

REVOKE ALL ON public.owner_partners FROM anon;

-- Tìm-hoặc-tạo (INVOKER ⇒ RLS ở trên áp dụng). p_workspace_id NULL ⇒ phạm vi cá nhân của người gọi.
-- Trùng tên (không phân biệt hoa thường / dấu) hoặc trùng tổ chức trong danh bạ ⇒ trả dòng sẵn có.
CREATE FUNCTION public.owner_partner_ensure(
  p_workspace_id UUID, p_kind TEXT, p_name TEXT, p_auction_org_id UUID DEFAULT NULL
) RETURNS public.owner_partners
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_row  public.owner_partners;
  v_name TEXT := p_name;
  v_user UUID := CASE WHEN p_workspace_id IS NULL THEN auth.uid() END;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Cần đăng nhập' USING ERRCODE = '42501';
  END IF;
  IF p_auction_org_id IS NOT NULL THEN
    SELECT o.name INTO v_name FROM public.auction_organizations o WHERE o.id = p_auction_org_id;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Không tìm thấy tổ chức đấu giá' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_row FROM public.owner_partners p
     WHERE p.auction_org_id = p_auction_org_id
       AND p.workspace_id IS NOT DISTINCT FROM p_workspace_id
       AND p.user_id IS NOT DISTINCT FROM v_user;
    IF FOUND THEN RETURN v_row; END IF;
  END IF;
  IF public.partner_name_key(v_name) IS NULL THEN
    RAISE EXCEPTION 'Tên đối tác không được để trống' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.owner_partners p
   WHERE p.kind = p_kind
     AND p.name_key = public.partner_name_key(v_name)
     AND p.workspace_id IS NOT DISTINCT FROM p_workspace_id
     AND p.user_id IS NOT DISTINCT FROM v_user;
  IF FOUND THEN
    -- Đối tác tự nhập trùng tên một tổ chức trong danh bạ ⇒ gắn luôn tổ chức.
    IF p_auction_org_id IS NOT NULL AND v_row.auction_org_id IS NULL THEN
      UPDATE public.owner_partners SET auction_org_id = p_auction_org_id WHERE id = v_row.id RETURNING * INTO v_row;
    END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.owner_partners (workspace_id, user_id, kind, name, auction_org_id)
  VALUES (p_workspace_id, v_user, p_kind, v_name, p_auction_org_id)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_partner_ensure(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_partner_ensure(UUID, TEXT, TEXT, UUID) TO authenticated;

-- owner_partner_ensure gắn auction_org_id vào dòng sẵn có ⇒ cần quyền UPDATE đúng cột đó.
CREATE POLICY owner_partners_update ON public.owner_partners
  FOR UPDATE TO authenticated
  USING (CASE WHEN workspace_id IS NOT NULL THEN public.owner_ws_has(workspace_id, 'so-hoa', 'update')
              ELSE user_id = auth.uid() END)
  WITH CHECK (CASE WHEN workspace_id IS NOT NULL THEN public.owner_ws_has(workspace_id, 'so-hoa', 'update')
                   ELSE user_id = auth.uid() END);
REVOKE UPDATE ON public.owner_partners FROM authenticated;
GRANT UPDATE (auction_org_id) ON public.owner_partners TO authenticated;

-- ─── Phần dịch vụ của hồ sơ trỏ về đối tác ────────────────────────────────────
ALTER TABLE public.asset_posting_dossier_items
  ADD COLUMN partner_id UUID REFERENCES public.owner_partners(id) ON DELETE SET NULL;

CREATE INDEX idx_asset_posting_dossier_items_partner ON public.asset_posting_dossier_items (partner_id);

-- Bản LIVE của hàm (đọc pg_get_functiondef 04/10) + khối đối tác.
CREATE OR REPLACE FUNCTION public.asset_posting_dossier_items_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_post    public.asset_postings;
  v_partner public.owner_partners;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.posting_id IS DISTINCT FROM OLD.posting_id THEN
      RAISE EXCEPTION 'Không đổi được hồ sơ của phần dịch vụ' USING ERRCODE = '22023';
    END IF;
    NEW.created_by := OLD.created_by;
  END IF;
  SELECT * INTO v_post FROM public.asset_postings p WHERE p.id = NEW.posting_id;
  NEW.workspace_id := v_post.workspace_id;

  -- Đối tác chỉ có nghĩa với "Đối tác riêng"; phải cùng loại + cùng phạm vi với hồ sơ.
  IF NEW.source <> 'external_partner' THEN
    NEW.partner_id := NULL;
  ELSIF NEW.partner_id IS NOT NULL THEN
    SELECT * INTO v_partner FROM public.owner_partners pt WHERE pt.id = NEW.partner_id;
    IF NOT FOUND
       OR v_partner.kind <> NEW.kind
       OR NOT (CASE WHEN v_post.workspace_id IS NOT NULL THEN v_partner.workspace_id = v_post.workspace_id
                    ELSE v_partner.workspace_id IS NULL AND v_partner.user_id = v_post.user_id END) THEN
      RAISE EXCEPTION 'Đối tác không thuộc phạm vi của hồ sơ' USING ERRCODE = '22023';
    END IF;
    NEW.partner_name   := v_partner.name;
    NEW.partner_org_id := v_partner.auction_org_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asset_posting_dossier_items_sync() FROM PUBLIC, anon, authenticated;
