-- Cổng giám định (BR-GD-02 / BR-GD-03) — tách khỏi 20260915000020 cho dễ đọc.
--
-- 1. Nộp hồ sơ (status → 'active'): RAISE thay vì nuốt. Người bán bấm "Hoàn tất" phải
--    thấy lỗi, không được lặng lẽ lưu thành nháp.
-- 2. Đưa lô vào phiên đấu giá: trigger RIÊNG trên auction_session_items. KHÔNG sửa
--    auction_session_items_validate — hàm đó đã bị viết lại ở 20260912000005 và còn
--    phiên song song đang đụng tới; thêm trigger độc lập thì không phải chép thân hàm.
--
-- Mã lỗi đặt ở ĐẦU message (GD_REQUIRED / GD_FAILED_CATEGORY) để client ánh xạ ra câu
-- tiếng Việt mà không phải so nguyên văn.

CREATE OR REPLACE FUNCTION public.asset_postings_authentication_gate()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reasons TEXT[];
  v_verdict TEXT;
BEGIN
  v_verdict := public._authentication_current_verdict(NEW.id);

  -- BR-GD-02: kết luận tiêu cực hiện hành ⇒ không đăng ở nhóm Cổ vật.
  IF NEW.parent_slug = 'co-vat-suu-tam' AND v_verdict IN ('inconclusive', 'suspected_fake') THEN
    RAISE EXCEPTION 'GD_FAILED_CATEGORY: Kết quả giám định không cho phép đăng tài sản này ở nhóm Cổ vật.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- BR-GD-03: bắt buộc giám định ⇒ chặn tới khi có chứng thư "xác thực".
  v_reasons := public._authentication_required_reasons(NEW.id, NEW.user_id, NEW.parent_slug, NEW.starting_price);
  IF cardinality(v_reasons) > 0 AND v_verdict IS DISTINCT FROM 'authentic' THEN
    RAISE EXCEPTION 'GD_REQUIRED: Tài sản này bắt buộc có chứng thư giám định trước khi nộp (%).',
      array_to_string(v_reasons, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.asset_postings_authentication_gate() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER asset_postings_authentication_gate_ins
  BEFORE INSERT ON public.asset_postings
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.asset_postings_authentication_gate();

CREATE TRIGGER asset_postings_authentication_gate_upd
  BEFORE UPDATE ON public.asset_postings
  FOR EACH ROW
  WHEN (NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active')
  EXECUTE FUNCTION public.asset_postings_authentication_gate();

CREATE OR REPLACE FUNCTION public.auction_session_items_authentication_gate()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_p       public.asset_postings%ROWTYPE;
  v_verdict TEXT;
BEGIN
  SELECT * INTO v_p FROM public.asset_postings WHERE id = NEW.asset_posting_id;
  IF NOT FOUND THEN
    RETURN NEW;  -- auction_session_items_validate báo lỗi thiếu nguồn.
  END IF;
  v_verdict := public._authentication_current_verdict(v_p.id);

  IF (v_p.parent_slug = 'co-vat-suu-tam'
      OR public.asset_parent_slug(COALESCE(NEW.category_slug, '')) = 'co-vat-suu-tam')
     AND v_verdict IN ('inconclusive', 'suspected_fake') THEN
    RAISE EXCEPTION 'GD_FAILED_CATEGORY: Tài sản không đạt giám định — không đưa vào phiên ở nhóm Cổ vật được.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF cardinality(public._authentication_required_reasons(v_p.id, v_p.user_id, v_p.parent_slug, v_p.starting_price)) > 0
     AND v_verdict IS DISTINCT FROM 'authentic' THEN
    RAISE EXCEPTION 'GD_REQUIRED: Tài sản bắt buộc có chứng thư giám định trước khi đưa vào phiên.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auction_session_items_authentication_gate() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER auction_session_items_authentication_gate
  BEFORE INSERT ON public.auction_session_items
  FOR EACH ROW
  WHEN (NEW.asset_posting_id IS NOT NULL)
  EXECUTE FUNCTION public.auction_session_items_authentication_gate();
