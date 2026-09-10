-- Dữ liệu mẫu: hợp đồng hợp tác với CTĐG Minh Đức (tổ chức demo của admin@gmail.com).
--
-- Mục đích: mở /admin/doi-tac là thấy ngay một hồ sơ đối tác ĐÃ gắn tổ chức đấu
-- giá và ĐÃ có hợp đồng hiệu lực, để đối chiếu khi kiểm thử luồng ký gửi.
--
-- Idempotent theo UUID sentinel (phải là hex hợp lệ — 'fc…' chứ không phải 'sc…').

DO $$
DECLARE
  v_sup_id  UUID := 'fc000001-0000-4000-8000-000000000001';
  v_con_id  UUID := 'fc000002-0000-4000-8000-000000000001';
  v_org     UUID;
  v_svc     UUID;
BEGIN
  SELECT auction_org_id INTO v_org
    FROM public.organizations
   WHERE id = 'ad000001-0000-4000-8000-000000000001';

  IF v_org IS NULL THEN
    RAISE NOTICE 'Bỏ qua seed: chưa có tổ chức demo Minh Đức';
    RETURN;
  END IF;

  -- Đối tác đã tồn tại cho tổ chức này (unique index) thì thôi, không đè.
  IF EXISTS (SELECT 1 FROM public.suppliers WHERE auction_org_id = v_org) THEN
    RAISE NOTICE 'Bỏ qua seed: tổ chức đã có hồ sơ đối tác';
    RETURN;
  END IF;

  INSERT INTO public.suppliers
    (id, name, supplier_type, contact_name, phone, email, tax_code, address,
     bank_name, bank_account, default_commission_type, default_commission_rate,
     auction_org_id, status, note)
  VALUES (
    v_sup_id, 'Công ty Đấu giá Hợp danh Minh Đức', 'company',
    'Nguyễn Minh Đức', '0912345678', 'lienhe@dgminhduc.vn', '0109876543',
    'Số 12 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
    'Vietcombank', '0011000123456', 'percent', 5,
    v_org, 'active',
    'Đối tác ký gửi khu vực miền Bắc. Hợp đồng khung ký theo năm.'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.supplier_contracts
    (id, supplier_id, contract_no, title, signed_date, effective_from, effective_to,
     signer_name, signer_title, our_signer_name, status, note)
  VALUES (
    v_con_id, v_sup_id, '07/2026/HĐHT-TSDG',
    'Hợp đồng hợp tác môi giới tài sản đấu giá',
    DATE '2026-01-05', DATE '2026-01-05', DATE '2026-12-31',
    'Nguyễn Minh Đức', 'Giám đốc', 'Trần Thị Thu Hà', 'active',
    'Sàn giới thiệu chủ tài sản; hoa hồng tính trên doanh thu tổ chức thu được.'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_svc FROM public.services WHERE name = 'Hoa hồng môi giới ký gửi';
  IF v_svc IS NOT NULL THEN
    INSERT INTO public.supplier_contract_lines
      (contract_id, service_id, commission_type, commission_value, note)
    SELECT v_con_id, v_svc, 'percent', 5,
           'Áp cho mọi loại tài sản; tính trên giá trị thương vụ tổ chức thu được.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.supplier_contract_lines
       WHERE contract_id = v_con_id AND service_id = v_svc
    );
  END IF;

  RAISE NOTICE 'Seed OK: đối tác Minh Đức + hợp đồng 07/2026 (môi giới ký gửi 5%%)';
END $$;
