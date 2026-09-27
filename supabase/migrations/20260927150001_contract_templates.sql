-- Mẫu hợp đồng có phiên bản (admin "Pháp lý & Đấu giá" → Mẫu hợp đồng).
--
-- Mẫu = câu chữ của các "ô điều khoản" (slot). Cấu trúc điều khoản và các điều
-- sinh từ dữ liệu (các bên, tài sản, giá) vẫn nằm trong code — schema slot theo
-- loại ở src/lib/contracts/templates/schema.ts, mặc định = hằng số TS cũ, nên
-- builder PDF thiếu slot nào thì lấy hằng số cho slot đó.
--
-- Phiên bản BẤT BIẾN (như legal_documents): chỉ tạo mới / nhân bản, không sửa.
-- "Đang áp dụng" = bản có effective_date <= hôm nay (giờ Việt Nam) mới nhất.
-- Seed 6 mẫu: HDDV (ký gửi) + HDMB (mua bán) chép nguyên từ clauses.ts, 4 mẫu
-- HDCU (hợp đồng cung ứng dịch vụ) soạn mới. TẤT CẢ CHƯA RÀ SOÁT PHÁP LÝ.

-- Ngày "hôm nay" theo giờ Việt Nam — dùng chung cho mọi so sánh hiệu lực mẫu,
-- để admin tạo bản "hiệu lực hôm nay" lúc 01:00 sáng không bị coi là lùi ngày.
CREATE OR REPLACE FUNCTION public.contract_today()
RETURNS DATE
LANGUAGE sql STABLE
SET search_path = public
AS $$ SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date $$;

CREATE TABLE public.contract_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type  TEXT NOT NULL CHECK (template_type IN (
                   'consignment', 'sale',
                   'service:vr-tour', 'service:giam-dinh',
                   'service:tu-van-phap-ly', 'service:tu-van-dau-gia')),
  version        TEXT NOT NULL CHECK (length(btrim(version)) BETWEEN 3 AND 60),
  effective_date DATE NOT NULL,
  changelog      TEXT,
  clauses        JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(clauses) = 'object'),
  -- Không FK: bảng bất biến, ON DELETE SET NULL là một UPDATE (cùng lý do recorded_by
  -- của auction_sale_payments).
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_type, version)
);

CREATE INDEX idx_contract_templates_type_effective
  ON public.contract_templates (template_type, effective_date DESC, created_at DESC);

-- Người tạo / thời điểm tạo do server đặt, client không tự khai.
CREATE OR REPLACE FUNCTION public.contract_templates_fill()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.created_by := auth.uid();
  NEW.created_at := now();
  NEW.version := btrim(NEW.version);
  RETURN NEW;
END;
$$;

CREATE TRIGGER contract_templates_fill
  BEFORE INSERT ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.contract_templates_fill();

-- Bất biến kể cả với SECURITY DEFINER / service_role: thiếu UPDATE policy không đủ.
CREATE OR REPLACE FUNCTION public.contract_templates_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Mẫu hợp đồng là bất biến — hãy tạo phiên bản mới.'
    USING ERRCODE = 'P0001', HINT = 'CT_IMMUTABLE';
END;
$$;

CREATE TRIGGER contract_templates_immutable
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.contract_templates_immutable();

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Mẫu không bí mật: tổ chức và chủ tài sản cần đọc để dựng PDF ở client.
CREATE POLICY contract_templates_read ON public.contract_templates
  FOR SELECT TO authenticated USING (true);

-- Không lùi ngày: lịch sử "bản nào áp dụng ngày nào" phải tất định.
CREATE POLICY contract_templates_admin_insert ON public.contract_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission('mau-hop-dong', 'create')
              AND effective_date >= public.contract_today());

-- Chỉ xoá được bản CHƯA hiệu lực (chưa hợp đồng nào dùng được).
CREATE POLICY contract_templates_admin_delete ON public.contract_templates
  FOR DELETE TO authenticated
  USING (public.admin_has_permission('mau-hop-dong', 'delete')
         AND effective_date > public.contract_today());

REVOKE UPDATE ON public.contract_templates FROM authenticated, anon;

-- Bản đang áp dụng của một loại (0 hoặc 1 dòng).
CREATE OR REPLACE FUNCTION public.active_contract_template(_type TEXT)
RETURNS SETOF public.contract_templates
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT *
    FROM public.contract_templates
   WHERE template_type = _type
     AND effective_date <= public.contract_today()
   ORDER BY effective_date DESC, created_at DESC
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.active_contract_template(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_contract_template(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contract_today() TO authenticated;

-- ─── Seed ───────────────────────────────────────────────────────────────────

INSERT INTO public.contract_templates (template_type, version, effective_date, changelog, clauses) VALUES
('consignment', 'HDDV-MAU-2026-09', DATE '2026-09-01',
 'Bản đầu, chép từ src/lib/consignment/contract-pdf/clauses.ts. CHƯA RÀ SOÁT PHÁP LÝ.',
 jsonb_build_object(
   'legal_bases', jsonb_build_array(
     'Căn cứ Bộ luật Dân sự số 91/2015/QH13;',
     'Căn cứ Luật Đấu giá tài sản số 01/2016/QH14, được sửa đổi, bổ sung năm 2024, và các văn bản hướng dẫn thi hành;',
     'Căn cứ nhu cầu và khả năng của hai bên.'),
   'owner_duties', jsonb_build_array(
     'Cung cấp đầy đủ, chính xác thông tin và giấy tờ chứng minh quyền sở hữu, quyền được bán tài sản; chịu trách nhiệm về tính hợp pháp của tài sản.',
     'Tạo điều kiện để Bên B và người tham gia đấu giá xem tài sản theo lịch hai bên thống nhất.',
     'Thanh toán thù lao dịch vụ và chi phí đấu giá theo Điều 4.',
     'Ký hợp đồng mua bán tài sản đấu giá và giao tài sản cho người trúng đấu giá theo quy định.',
     'Được yêu cầu Bên B cung cấp thông tin về tiến độ và kết quả đấu giá.'),
   'org_duties', jsonb_build_array(
     'Tổ chức cuộc đấu giá theo đúng trình tự, thủ tục của pháp luật về đấu giá tài sản và theo phương án tại Điều 3.',
     'Niêm yết, thông báo công khai việc đấu giá; bán hồ sơ, tiếp nhận hồ sơ đăng ký và tiền đặt trước của người tham gia đấu giá.',
     'Bảo quản hồ sơ, giấy tờ do Bên A giao; không sử dụng thông tin của Bên A ngoài mục đích thực hiện hợp đồng.',
     'Chuyển kết quả đấu giá, biên bản đấu giá và danh sách người trúng đấu giá cho Bên A theo quy định.',
     'Được nhận thù lao dịch vụ và được thanh toán chi phí đấu giá theo Điều 4.'),
   'payment_terms',
     'Thù lao dịch vụ và chi phí đấu giá được thanh toán sau khi cuộc đấu giá thành, trong thời hạn hai bên thống nhất. Trường hợp đấu giá không thành, Bên A thanh toán cho Bên B các chi phí thực tế, hợp lý theo quy định.',
   'termination', jsonb_build_array(
     'Hợp đồng chấm dứt khi các bên hoàn thành nghĩa vụ, khi hai bên thoả thuận chấm dứt, hoặc trong các trường hợp pháp luật quy định.',
     'Bên đơn phương chấm dứt hợp đồng trái quy định phải bồi thường thiệt hại phát sinh cho bên còn lại.',
     'Tranh chấp phát sinh được giải quyết trước hết bằng thương lượng; không thương lượng được thì mỗi bên có quyền yêu cầu Toà án có thẩm quyền giải quyết.'),
   'effect', jsonb_build_array(
     'Hợp đồng có hiệu lực kể từ ngày hai bên ký.',
     'Hợp đồng được lập thành 04 bản có giá trị pháp lý như nhau, mỗi bên giữ 02 bản.'),
   'draft_notice',
     'Dự thảo tạo tự động từ báo giá đã chốt trên sàn. Điều khoản là mẫu tham khảo — hai bên rà soát, chỉnh sửa trước khi ký.'
 )),
('sale', 'HDMB-MAU-2026-09', DATE '2026-09-01',
 'Bản đầu, chép từ src/lib/saleContracts/contract-pdf/clauses.ts. CHƯA RÀ SOÁT PHÁP LÝ.',
 jsonb_build_object(
   'legal_bases', jsonb_build_array(
     'Căn cứ Bộ luật Dân sự số 91/2015/QH13;',
     'Căn cứ Luật Đấu giá tài sản số 01/2016/QH14, được sửa đổi, bổ sung năm 2024, và các văn bản hướng dẫn thi hành;',
     'Căn cứ Biên bản đấu giá tài sản và kết quả cuộc đấu giá đã được công bố;',
     'Căn cứ sự thoả thuận của các bên.'),
   'deposit_clause',
     'Tiền đặt trước mà Bên mua đã nộp để tham gia cuộc đấu giá được chuyển thành tiền đặt cọc để bảo đảm thực hiện hợp đồng và được trừ vào giá mua tài sản.',
   'buyer_duties', jsonb_build_array(
     'Thanh toán đủ và đúng hạn số tiền mua tài sản theo Điều 4 của hợp đồng này.',
     'Nhận bàn giao tài sản theo thời gian, địa điểm hai bên thống nhất; ký biên bản bàn giao tài sản.',
     'Tự chịu chi phí và thực hiện thủ tục đăng ký quyền sở hữu, quyền sử dụng tài sản, trừ trường hợp các bên có thoả thuận khác.',
     'Được yêu cầu Bên bán giao tài sản đúng hiện trạng và giao đầy đủ giấy tờ liên quan đến tài sản.'),
   'seller_duties', jsonb_build_array(
     'Giao tài sản đúng hiện trạng đã công bố tại cuộc đấu giá và giao đầy đủ giấy tờ liên quan đến tài sản.',
     'Bảo đảm tài sản thuộc quyền định đoạt hợp pháp của mình và không có tranh chấp tại thời điểm ký hợp đồng, trừ những nội dung đã công bố công khai.',
     'Phối hợp với Bên mua thực hiện thủ tục đăng ký sang tên theo quy định của pháp luật.',
     'Được nhận đủ tiền mua tài sản theo Điều 4 của hợp đồng này.'),
   'handover_terms',
     'Tài sản được bàn giao trên thực địa theo hiện trạng tại thời điểm đấu giá, sau khi Bên mua đã thanh toán đủ tiền mua tài sản. Việc bàn giao được lập thành biên bản có chữ ký của hai bên.',
   'title_transfer_terms',
     'Hai bên phối hợp thực hiện thủ tục đăng ký chuyển quyền sở hữu, quyền sử dụng tài sản tại cơ quan nhà nước có thẩm quyền theo quy định của pháp luật. Thời điểm chuyển quyền sở hữu được xác định theo quy định của pháp luật chuyên ngành.',
   'breach_terms', jsonb_build_array(
     'Bên mua không thanh toán đủ tiền mua tài sản đúng hạn thì bị coi là từ chối mua tài sản; tiền đặt cọc thuộc về Bên bán, trừ trường hợp các bên có thoả thuận khác hoặc pháp luật có quy định khác.',
     'Bên bán từ chối giao tài sản thì phải hoàn trả cho Bên mua số tiền đã nhận và bồi thường thiệt hại theo quy định của pháp luật.',
     'Hợp đồng chấm dứt khi các bên hoàn thành nghĩa vụ, khi hai bên thoả thuận chấm dứt, hoặc trong các trường hợp pháp luật quy định.',
     'Tranh chấp phát sinh được giải quyết trước hết bằng thương lượng; không thương lượng được thì mỗi bên có quyền yêu cầu Toà án có thẩm quyền giải quyết.'),
   'effect', jsonb_build_array(
     'Hợp đồng có hiệu lực kể từ ngày các bên ký.',
     'Hợp đồng được lập thành 04 bản có giá trị pháp lý như nhau, mỗi bên giữ 02 bản.'),
   'notarization_note',
     'Hợp đồng này được công chứng, chứng thực theo quy định của pháp luật trước khi thực hiện thủ tục đăng ký quyền sở hữu.',
   'draft_notice',
     'Dự thảo tạo tự động từ kết quả cuộc đấu giá trên sàn. Điều khoản là mẫu tham khảo — các bên rà soát, chỉnh sửa trước khi ký.'
 ));

-- 4 mẫu HDCU: phần chung giống nhau, khác phạm vi / sản phẩm / giới hạn trách nhiệm.
WITH common AS (
  SELECT jsonb_build_object(
    'provider_name', '[CẦN NHẬP] Tên pháp nhân vận hành sàn Tài Sản Đấu Giá',
    'provider_tax_code', '[CẦN NHẬP]',
    'provider_address', '[CẦN NHẬP]',
    'provider_representative', '[CẦN NHẬP]',
    'provider_rep_title', '[CẦN NHẬP]',
    'provider_email', '[CẦN NHẬP]',
    'legal_bases', jsonb_build_array(
      'Căn cứ Bộ luật Dân sự số 91/2015/QH13;',
      'Căn cứ Luật Thương mại số 36/2005/QH11;',
      'Căn cứ Luật Giao dịch điện tử số 20/2023/QH15;',
      'Căn cứ nhu cầu của Bên A và báo giá của Bên B trên sàn Tài Sản Đấu Giá.'),
    'owner_duties', jsonb_build_array(
      'Cung cấp đầy đủ, trung thực thông tin, tài liệu và điều kiện cần thiết để Bên B thực hiện dịch vụ.',
      'Thanh toán đủ phí dịch vụ theo Điều 3 trước khi dịch vụ được thực hiện.',
      'Phối hợp với đơn vị thực hiện theo lịch hẹn và hướng dẫn trên sàn.',
      'Được nhận kết quả dịch vụ đúng phạm vi tại Điều 2 và được yêu cầu Bên B giải thích kết quả.'),
    'provider_duties', jsonb_build_array(
      'Thực hiện dịch vụ đúng phạm vi và tiến độ đã báo giá, thông qua đơn vị thực hiện có năng lực chuyên môn.',
      'Bảo mật thông tin, tài liệu của Bên A; chỉ sử dụng cho mục đích thực hiện hợp đồng.',
      'Thông báo kịp thời cho Bên A khi phát sinh sự kiện ảnh hưởng đến tiến độ hoặc kết quả dịch vụ.',
      'Được nhận đủ phí dịch vụ theo Điều 3.'),
    'payment_terms',
      'Bên A thanh toán một lần toàn bộ phí dịch vụ qua cổng thanh toán trên sàn trước khi dịch vụ được thực hiện. Phí đã thanh toán không được hoàn lại, trừ trường hợp Bên B không thể thực hiện dịch vụ vì lý do từ phía Bên B.',
    'termination', jsonb_build_array(
      'Trước khi thanh toán, Bên A có quyền không tiếp tục; nghĩa vụ thanh toán chỉ phát sinh khi Bên A hoàn tất thanh toán.',
      'Hợp đồng chấm dứt khi Bên B bàn giao kết quả dịch vụ, khi hai bên thoả thuận chấm dứt, hoặc trong các trường hợp pháp luật quy định.',
      'Tranh chấp phát sinh được giải quyết trước hết bằng thương lượng; không thương lượng được thì mỗi bên có quyền yêu cầu Toà án có thẩm quyền giải quyết.'),
    'electronic_acceptance',
      'Hợp đồng được giao kết bằng phương tiện điện tử: khi Bên A chọn "Tôi đồng ý" trên sàn, nội dung hợp đồng này cùng mã hợp đồng, thời điểm đồng ý và mã kiểm tra được lưu trữ và có giá trị như văn bản theo Luật Giao dịch điện tử.',
    'effect', jsonb_build_array(
      'Hợp đồng có hiệu lực kể từ thời điểm Bên A đồng ý trên sàn và chỉ áp dụng cho báo giá tại Điều 3; báo giá thay đổi thì hai bên giao kết lại.',
      'Bên A tải được bản PDF của hợp đồng tại mục Hợp đồng trên sàn bất kỳ lúc nào.')
  ) AS c
)
INSERT INTO public.contract_templates (template_type, version, effective_date, changelog, clauses)
SELECT t.template_type, t.version, DATE '2026-09-01',
       'Bản đầu. CHƯA RÀ SOÁT PHÁP LÝ — thông tin Bên B còn [CẦN NHẬP].',
       common.c || t.specific
  FROM common, (VALUES
  ('service:vr-tour', 'HDCU-VR-MAU-2026-09', jsonb_build_object(
    'scope', jsonb_build_array(
      'Chụp, dựng và bàn giao tour thực tế ảo (VR tour 360°) của tài sản theo gói dịch vụ đã chọn.',
      'Hẹn lịch chụp tại địa điểm tài sản; Bên A bảo đảm tiếp cận được tài sản vào thời gian đã hẹn.',
      'Gắn tour lên trang tài sản trên sàn khi hồ sơ tài sản được duyệt.'),
    'deliverables',
      'Đường dẫn xem VR tour của tài sản, gửi trên sàn trong thời hạn đã báo giá kể từ buổi chụp.',
    'disclaimer', jsonb_build_array(
      'VR tour thể hiện hiện trạng tài sản tại thời điểm chụp; Bên B không chịu trách nhiệm về thay đổi hiện trạng sau đó.',
      'Tour chỉ hiển thị công khai khi hồ sơ tài sản được sàn duyệt.'))),
  ('service:giam-dinh', 'HDCU-GD-MAU-2026-09', jsonb_build_object(
    'scope', jsonb_build_array(
      'Giám định tính xác thực của tài sản theo phương thức đã chọn: từ ảnh, gửi hiện vật hoặc giám định tại chỗ.',
      'Bên A gửi hiện vật hoặc bố trí giám định tại chỗ theo hướng dẫn của Bên B khi phương thức yêu cầu.'),
    'deliverables',
      'Chứng thư giám định (PDF) kèm kết luận: xác thực, chưa đủ căn cứ kết luận, hoặc nghi ngờ không xác thực.',
    'disclaimer', jsonb_build_array(
      'Kết luận giám định dựa trên hiện vật, hình ảnh và tài liệu Bên A cung cấp tại thời điểm giám định.',
      'Kết luận tiêu cực có thể khiến hồ sơ tài sản bị chuyển về trạng thái nháp theo quy định của sàn; phí dịch vụ vẫn được tính vì dịch vụ đã được thực hiện.'))),
  ('service:tu-van-phap-ly', 'HDCU-TVPL-MAU-2026-09', jsonb_build_object(
    'scope', jsonb_build_array(
      'Rà soát hồ sơ pháp lý của tài sản do Bên A cung cấp theo danh mục kiểm tra của nhóm tài sản.',
      'Chỉ ra giấy tờ còn thiếu, nội dung cần làm rõ và việc cần làm tiếp theo.'),
    'deliverables',
      'Bảng kết quả rà soát từng mục (đủ / thiếu / cần làm rõ) và nhận xét tổng hợp của chuyên gia, xem trên sàn.',
    'disclaimer', jsonb_build_array(
      'Kết quả tư vấn mang tính tham khảo, không thay thế ý kiến của cơ quan nhà nước có thẩm quyền và không làm thay đổi trạng thái duyệt hồ sơ trên sàn.',
      'Bên B không chịu trách nhiệm về tính xác thực của tài liệu do Bên A cung cấp.'))),
  ('service:tu-van-dau-gia', 'HDCU-TVDG-MAU-2026-09', jsonb_build_object(
    'scope', jsonb_build_array(
      'Phân tích tài sản và mục tiêu bán của Bên A để đề xuất phương án đấu giá: hình thức, phương thức, giá khởi điểm, bước giá, tiền đặt trước, thời lượng.'),
    'deliverables',
      'Phương án đấu giá kèm lý giải, xem trên sàn; Bên A được chấp nhận hoặc từ chối phương án.',
    'disclaimer', jsonb_build_array(
      'Phương án mang tính tư vấn, không tự động áp dụng vào phiên đấu giá; tổ chức đấu giá quyết định cấu hình phiên theo quy định.',
      'Bên B không cam kết kết quả bán hay mức giá trúng đấu giá.')))
  ) AS t(template_type, version, specific);
