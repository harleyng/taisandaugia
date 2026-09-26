-- Đối tác quét 3D GIẢ LẬP — thay cho app + cloud đối tác trong lúc chưa ký đối tác thật.
--
-- Trang /doi-tac-3d/quet (mô phỏng app đối tác) gọi hàm này thay vì webhook: gọi
-- thẳng attach/fail/mark_processing — CÙNG các hàm mà edge function scan3d-webhook
-- gọi — nên luật BR-3D-02 (lot_id khớp), idempotent, hoàn credit, chưa công khai
-- được kiểm giống hệt đường thật. Chỉ lớp chữ ký HMAC là của riêng webhook.
--
-- Chốt an toàn: chỉ phiên quét partner = 'mock', đúng chủ, đúng scan_token, và model
-- LUÔN là file mẫu cố định trong bucket asset-3d — không gắn được URL tuỳ ý.
-- Khi có đối tác thật: phiên quét mới mang partner khác ⇒ hàm này tự vô hiệu; xoá
-- hàm + trang giả lập là xong.

CREATE OR REPLACE FUNCTION public.mock_partner_deliver_asset_3d_scan(
  _scan_id UUID,
  _lot_id  UUID,
  _token   TEXT,
  _outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scan public.asset_3d_scans%ROWTYPE;
  v_job  TEXT;
  -- File mẫu CC0 (Khronos glTF Sample Assets — SheenChair), tải lên bucket asset-3d.
  c_base CONSTANT TEXT := 'https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-3d/samples/';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_scan FROM public.asset_3d_scans WHERE id = _scan_id;
  IF NOT FOUND OR v_scan.user_id <> auth.uid() OR v_scan.partner <> 'mock' OR v_scan.scan_token <> _token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'scan_not_found');
  END IF;

  v_job := 'mock-' || _scan_id::text;

  IF _outcome = 'processing' THEN
    RETURN public.mark_asset_3d_processing(_scan_id, _lot_id, v_job);
  ELSIF _outcome = 'ready' THEN
    RETURN public.attach_asset_3d_model(_scan_id, _lot_id, v_job,
                                        c_base || 'sheen-chair.glb', c_base || 'sheen-chair.jpg', 'glb');
  ELSIF _outcome = 'failed' THEN
    RETURN public.fail_asset_3d_scan(_scan_id, _lot_id, v_job, 'Ảnh quét thiếu góc — vui lòng quét lại');
  END IF;

  RETURN jsonb_build_object('ok', false, 'reason', 'invalid_outcome');
END;
$$;

REVOKE ALL ON FUNCTION public.mock_partner_deliver_asset_3d_scan(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mock_partner_deliver_asset_3d_scan(UUID, UUID, TEXT, TEXT) TO authenticated;
