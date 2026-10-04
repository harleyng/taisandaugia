-- Huy hiệu "Hồ sơ hoàn chỉnh" công khai (docs/owner-dossier-plan.md — Phase 4).
--
--  • Mọi đường công khai đi QUA get_public_dossier_trust (Phase 1) — cùng cổng (hồ sơ đã duyệt
--    & chưa huỷ) và cùng bộ lọc: không gợi ý, không tên đối tác, không tệp; giá thẩm định chỉ khi
--    chủ bật "Hiển thị giá thẩm định công khai". Hai hàm dưới đây CHỈ gom lượt gọi, không mở thêm cột.
--  • get_public_dossier_trusts: một lượt cho cả danh sách (lô của phiên, hộp thư yêu cầu ký gửi).
--  • get_shared_posting_dossier_trust: trang /hs/:code không biết posting_id (payload danh sách
--    trắng không có id) ⇒ tra theo mã link, cùng kiểm link như get_shared_posting nhưng KHÔNG đếm
--    lượt xem. Link tắt "hiện giá" ⇒ bỏ luôn giá thẩm định (chủ không muốn khách của link thấy giá).

-- ─── 1. Nhiều hồ sơ một lượt ─────────────────────────────────────────────────
CREATE FUNCTION public.get_public_dossier_trusts(p_posting_ids UUID[])
RETURNS TABLE (posting_id UUID, trust jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c_max_ids CONSTANT INT := 200;
  v_id      UUID;
  v_trust   jsonb;
BEGIN
  IF cardinality(p_posting_ids) > c_max_ids THEN
    RAISE EXCEPTION 'Tối đa % hồ sơ mỗi lần', c_max_ids USING ERRCODE = '22023';
  END IF;
  FOR v_id IN SELECT DISTINCT unnest(p_posting_ids) LOOP
    v_trust := public.get_public_dossier_trust(v_id);
    CONTINUE WHEN v_trust IS NULL;   -- chưa duyệt / đã huỷ / không tồn tại ⇒ im lặng bỏ qua
    posting_id := v_id;
    trust := v_trust;
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_dossier_trusts(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_dossier_trusts(UUID[]) TO anon, authenticated;

-- ─── 2. Theo mã link chia sẻ (/hs/:code) ─────────────────────────────────────
CREATE FUNCTION public.get_shared_posting_dossier_trust(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  l       public.posting_share_links%ROWTYPE;
  v_trust jsonb;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{12}$' THEN
    RETURN NULL;
  END IF;
  SELECT * INTO l FROM public.posting_share_links WHERE code = p_code;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at <= now()) THEN
    RETURN NULL;
  END IF;

  v_trust := public.get_public_dossier_trust(l.posting_id);
  IF v_trust IS NOT NULL AND NOT l.show_price THEN
    v_trust := v_trust - 'appraised_value';
  END IF;
  RETURN v_trust;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_shared_posting_dossier_trust(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_posting_dossier_trust(TEXT) TO anon, authenticated;

-- ─── 3. Kiểm chứng ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'public.get_public_dossier_trusts(uuid[])', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.get_shared_posting_dossier_trust(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'DOSSIER P4: khách vãng lai phải gọi được RPC công khai';
  END IF;
  IF has_function_privilege('anon', 'public._dossier_trust_compute(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'DOSSIER P4: hàm tính điểm nội bộ bị phơi ra client';
  END IF;
END;
$$;
