-- ─────────────────────────────────────────────────────────────────────────────
-- Danh mục bồi dưỡng chuyên môn — chuyển taxonomy từ HẰNG SỐ TRONG CODE sang
-- MASTER DATA do admin quản lý (/admin/quan-tri/boi-duong).
--
-- VÌ SAO PHẢI ĐỔI MÔ HÌNH, không chỉ thêm một loại:
-- Bản cũ hard-code 5 `cpd_kind`, trong đó 4 loại bị xếp cứng là "hình thức thay
-- thế Điều 26.2" ⇒ ĐẠT bất kể giờ. Nhưng 'SPEAKER' gộp làm một hai thứ khác hẳn
-- nhau: LÀM BÁO CÁO VIÊN tại hội thảo (Điều 26.2 — đạt cả năm) và ĐI DỰ hội thảo
-- (chỉ được quy đổi một số giờ). Hệ quả: một ĐGV chỉ đi nghe hội thảo vẫn được
-- chấm "Đạt cả năm" — sai kết luận tuân thủ, không phải sai nhãn.
--
-- Cách chữa: cách tính phụ thuộc (HÌNH THỨC × VAI TRÒ), và bộ quy tắc đó phải
-- sửa được khi văn bản pháp lý đổi mà không phải phát hành lại app.
--
-- RANH GIỚI GIỮ NGUYÊN: SQL chỉ GỘP SỐ (quy đổi giờ là số học), còn THỨ TỰ ƯU
-- TIÊN KẾT LUẬN (miễn ▸ đạt cả năm ▸ đủ 8 giờ ▸ chưa đủ/quá hạn) vẫn chỉ tồn tại
-- một bản duy nhất ở src/lib/personnel/cpd.ts — đúng cam kết ở 20260805000311.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Hình thức bồi dưỡng ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cpd_activity_types (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Mã BẤT BIẾN. Backfill, kết xuất và đối soát bám vào đây chứ không bám `name`
  -- (tên do admin sửa tự do).
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  legal_basis TEXT,

  -- "Hình thức này có phân vai trò không". true ⇒ cách tính nằm ở từng vai trò
  -- trong cpd_activity_roles, hai cột credit_mode/fixed_hours dưới đây bị bỏ qua.
  has_roles BOOLEAN NOT NULL DEFAULT false,

  --   HOURS      — cộng giờ vào mốc 8 giờ/năm
  --   FULL_YEAR  — hoàn thành nghĩa vụ cả năm, bất kể số giờ
  credit_mode TEXT NOT NULL DEFAULT 'HOURS'
    CHECK (credit_mode IN ('HOURS', 'FULL_YEAR')),
  -- Chỉ có nghĩa khi credit_mode='HOURS'. NULL = tổ chức nhập giờ thực tế;
  -- có số = quy đổi cố định mỗi lần tham gia.
  fixed_hours NUMERIC(5,1) CHECK (fixed_hours IS NULL OR fixed_hours >= 0),

  -- Nhãn động cho form khai báo. Tồn tại để gỡ các nhánh `if (kind === 'X')`
  -- từng nằm rải trong DossierEventDialog — admin thêm hình thức mới thì form tự
  -- có nhãn đúng, không phải sửa code.
  title_label TEXT NOT NULL DEFAULT 'Tên hoạt động',
  org_label   TEXT NOT NULL DEFAULT 'Đơn vị tổ chức',
  -- Gợi ý giấy tờ xác nhận theo Điều 27.1.
  evidence_hint TEXT,

  sort_order INT NOT NULL DEFAULT 0,
  -- Tắt = ẩn khỏi ô chọn. KHÔNG xoá, vì bản ghi cũ vẫn phải hiện đúng nhãn.
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Vai trò trong một hình thức ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cpd_activity_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type_id UUID NOT NULL
    REFERENCES public.cpd_activity_types(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  credit_mode TEXT NOT NULL DEFAULT 'HOURS'
    CHECK (credit_mode IN ('HOURS', 'FULL_YEAR')),
  fixed_hours NUMERIC(5,1) CHECK (fixed_hours IS NULL OR fixed_hours >= 0),

  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_cpd_role_code UNIQUE (activity_type_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cpd_roles_type
  ON public.cpd_activity_roles (activity_type_id, sort_order);

-- ─── 3. Trường hợp được miễn (Điều 26.3) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cpd_exemption_reasons (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- Hiện ngay dưới ô chọn ở form CTDG: cần nộp giấy gì cho trường hợp này.
  description TEXT,
  legal_basis TEXT,
  -- true ⇒ chặn lưu nếu chưa đính kèm minh chứng.
  requires_evidence BOOLEAN NOT NULL DEFAULT true,

  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS cpd_activity_types_updated_at ON public.cpd_activity_types;
CREATE TRIGGER cpd_activity_types_updated_at BEFORE UPDATE ON public.cpd_activity_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS cpd_activity_roles_updated_at ON public.cpd_activity_roles;
CREATE TRIGGER cpd_activity_roles_updated_at BEFORE UPDATE ON public.cpd_activity_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS cpd_exemption_reasons_updated_at ON public.cpd_exemption_reasons;
CREATE TRIGGER cpd_exemption_reasons_updated_at BEFORE UPDATE ON public.cpd_exemption_reasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. Seed ────────────────────────────────────────────────────────────────
-- ON CONFLICT DO NOTHING trên `code`: migration chạy lại không đè cấu hình admin
-- đã chỉnh. Danh mục CỐ Ý không bao giờ rỗng để form không có trạng thái "trống".
INSERT INTO public.cpd_activity_types
  (code, name, description, legal_basis, has_roles, credit_mode, fixed_hours,
   title_label, org_label, evidence_hint, sort_order)
VALUES
  ('COURSE',
   'Lớp bồi dưỡng do đơn vị được công nhận tổ chức',
   'Tổ chức xã hội – nghề nghiệp của đấu giá viên, Học viện Tư pháp hoặc Cục Bổ trợ tư pháp. Hoàn thành lớp bồi dưỡng được tính là hoàn thành nghĩa vụ cả năm.',
   'Điều 24.3, Điều 25', false, 'FULL_YEAR', NULL,
   'Khoá bồi dưỡng', 'Đơn vị tổ chức',
   'Chứng chỉ hoặc giấy chứng nhận tham gia lớp bồi dưỡng (Điều 27.1).', 10),

  ('SEMINAR',
   'Hội thảo, toạ đàm, diễn đàn',
   'Do Học viện Tư pháp, Cục Bổ trợ tư pháp hoặc Sở Tư pháp tổ chức. Cách tính khác nhau giữa báo cáo viên và người tham dự.',
   'Điều 26.2', true, 'HOURS', NULL,
   'Chuyên đề / tên hội thảo', 'Đơn vị tổ chức',
   'Giấy xác nhận tham gia hoạt động (Điều 27.1).', 20),

  ('TEACHING',
   'Giảng dạy về đấu giá tài sản',
   'Được tính là hoàn thành nghĩa vụ cả năm.',
   'Điều 26.2', false, 'FULL_YEAR', NULL,
   'Chuyên đề giảng dạy', 'Cơ sở đào tạo',
   'Giấy xác nhận tham gia giảng dạy (Điều 27.1).', 30),

  ('PUBLICATION',
   'Bài viết / sách / giáo trình đã công bố',
   'Được tính là hoàn thành nghĩa vụ cả năm.',
   'Điều 26.2', false, 'FULL_YEAR', NULL,
   'Tên bài viết / sách / giáo trình', 'Tạp chí / nhà xuất bản',
   'Bản chụp tạp chí, sách hoặc giáo trình đã công bố (Điều 27.1).', 40),

  ('OVERSEAS_COURSE',
   'Khoá bồi dưỡng ở nước ngoài',
   'Được tính là hoàn thành nghĩa vụ cả năm.',
   'Điều 26.2', false, 'FULL_YEAR', NULL,
   'Khoá bồi dưỡng', 'Đơn vị tổ chức',
   'Giấy xác nhận tham gia khoá bồi dưỡng (Điều 27.1).', 50)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.cpd_activity_roles
  (activity_type_id, code, name, description, credit_mode, fixed_hours, sort_order)
SELECT t.id, v.code, v.name, v.description, v.credit_mode, v.fixed_hours, v.sort_order
FROM public.cpd_activity_types t
JOIN (VALUES
  ('SEMINAR', 'SPEAKER',  'Báo cáo viên',
   'Làm báo cáo viên tại hội thảo, toạ đàm, diễn đàn — hoàn thành nghĩa vụ cả năm.',
   'FULL_YEAR', NULL::NUMERIC(5,1), 10),
  ('SEMINAR', 'ATTENDEE', 'Người tham dự',
   'Tham dự với tư cách người nghe — quy đổi số giờ cộng vào mốc 8 giờ/năm.',
   'HOURS', 4.0::NUMERIC(5,1), 20)
) AS v(type_code, code, name, description, credit_mode, fixed_hours, sort_order)
  ON v.type_code = t.code
ON CONFLICT (activity_type_id, code) DO NOTHING;

INSERT INTO public.cpd_exemption_reasons
  (code, name, description, legal_basis, requires_evidence, sort_order)
VALUES
  ('MATERNITY', 'Mang thai hoặc nuôi con dưới 12 tháng tuổi',
   'Giấy khai sinh của con, hoặc giấy tờ xác nhận đang mang thai.',
   'Điều 26.3', true, 10),
  ('LONG_ILLNESS', 'Điều trị bệnh dài ngày từ 3 tháng trở lên',
   'Xác nhận của cơ sở y tế cấp huyện trở lên, bệnh thuộc danh mục bệnh cần điều trị dài ngày của Bộ Y tế.',
   'Điều 26.3', true, 20),
  ('OTHER', 'Lý do khác',
   'Giấy tờ chứng minh trường hợp được miễn (nếu có).',
   NULL, false, 30)
ON CONFLICT (code) DO NOTHING;

-- ─── 5. Nối sự kiện sang danh mục ───────────────────────────────────────────
-- ON DELETE RESTRICT là CÓ CHỦ Ý: muốn gỡ một hình thức khỏi ô chọn thì tắt
-- is_active, không xoá — xoá được sẽ làm bản ghi lịch sử mất nhãn.
ALTER TABLE public.org_auctioneer_events
  ADD COLUMN IF NOT EXISTS cpd_activity_type_id UUID
    REFERENCES public.cpd_activity_types(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cpd_activity_role_id UUID
    REFERENCES public.cpd_activity_roles(id) ON DELETE RESTRICT;

-- Backfill 1-1 theo mã cũ.
UPDATE public.org_auctioneer_events e
   SET cpd_activity_type_id = t.id
  FROM public.cpd_activity_types t
 WHERE e.event_type = 'TRAINING'
   AND e.cpd_activity_type_id IS NULL
   AND e.cpd_kind IS NOT NULL
   AND t.code = e.cpd_kind
   AND e.cpd_kind <> 'SPEAKER';

-- 'SPEAKER' cũ = làm báo cáo viên tại hội thảo ⇒ (Hội thảo × Báo cáo viên).
-- Đây là cặp GIỮ NGUYÊN kết luận cũ (đạt cả năm); dữ liệu "đi dự hội thảo" trước
-- nay không phân biệt được nên không thể tự suy — tổ chức tự sửa lại nếu cần.
UPDATE public.org_auctioneer_events e
   SET cpd_activity_type_id = t.id,
       cpd_activity_role_id = r.id
  FROM public.cpd_activity_types t
  JOIN public.cpd_activity_roles r
    ON r.activity_type_id = t.id AND r.code = 'SPEAKER'
 WHERE e.event_type = 'TRAINING'
   AND e.cpd_activity_type_id IS NULL
   AND e.cpd_kind = 'SPEAKER'
   AND t.code = 'SEMINAR';

CREATE INDEX IF NOT EXISTS idx_oae_cpd_activity
  ON public.org_auctioneer_events (cpd_activity_type_id)
  WHERE event_type = 'TRAINING';

COMMENT ON COLUMN public.org_auctioneer_events.cpd_kind IS
  'LEGACY — không còn được đọc. Taxonomy chuyển sang cpd_activity_type_id / cpd_activity_role_id (20260806000030). Giữ cột để đối chiếu ngược.';
COMMENT ON COLUMN public.org_auctioneer_events.is_accredited_provider IS
  'LEGACY — không còn được đọc. "Đơn vị được công nhận" nay nằm trong định nghĩa của hình thức COURSE, không còn là cờ nhập tay từng bản ghi.';
COMMENT ON COLUMN public.org_auctioneer_events.cpd_activity_type_id IS
  'Hình thức bồi dưỡng, tra ở cpd_activity_types. NULL = bản ghi đào tạo không thuộc diện bồi dưỡng bắt buộc hằng năm.';
COMMENT ON COLUMN public.org_auctioneer_events.cpd_activity_role_id IS
  'Vai trò trong hoạt động. Bắt buộc khi hình thức có has_roles = true — cách tính giờ nằm ở đây chứ không ở hình thức.';

-- ─── 6. Trường hợp miễn trỏ sang danh mục ───────────────────────────────────
ALTER TABLE public.org_auctioneer_cpd_exemptions
  ADD COLUMN IF NOT EXISTS reason_id UUID
    REFERENCES public.cpd_exemption_reasons(id) ON DELETE RESTRICT;

UPDATE public.org_auctioneer_cpd_exemptions x
   SET reason_id = r.id
  FROM public.cpd_exemption_reasons r
 WHERE x.reason_id IS NULL AND r.code = x.reason;

-- PHẢI bỏ CHECK: admin thêm trường hợp miễn thứ tư thì INSERT sẽ chết vì cột
-- `reason` cũ chỉ nhận đúng ba giá trị hard-code.
ALTER TABLE public.org_auctioneer_cpd_exemptions
  DROP CONSTRAINT IF EXISTS org_auctioneer_cpd_exemptions_reason_check;
ALTER TABLE public.org_auctioneer_cpd_exemptions
  ALTER COLUMN reason DROP NOT NULL;

COMMENT ON COLUMN public.org_auctioneer_cpd_exemptions.reason IS
  'LEGACY — không còn được đọc. Dùng reason_id trỏ sang cpd_exemption_reasons (20260806000030).';

-- ─── 7. RLS ─────────────────────────────────────────────────────────────────
-- Đọc: MỞ CHO MỌI VAI, KHÔNG lọc is_active. Cố ý khác pattern services (chỉ đọc
-- is_active=true): ở đây danh mục là TỪ ĐIỂN NHÃN cho dữ liệu lịch sử — lọc dòng
-- đã tắt sẽ làm bản ghi cũ mất tên hình thức trên hồ sơ đã in ra. Danh mục không
-- chứa gì nhạy cảm nên mở đọc là an toàn.
ALTER TABLE public.cpd_activity_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpd_activity_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cpd_exemption_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cpd_types_read" ON public.cpd_activity_types;
CREATE POLICY "cpd_types_read" ON public.cpd_activity_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "cpd_types_admin_all" ON public.cpd_activity_types;
CREATE POLICY "cpd_types_admin_all" ON public.cpd_activity_types
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "cpd_roles_read" ON public.cpd_activity_roles;
CREATE POLICY "cpd_roles_read" ON public.cpd_activity_roles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "cpd_roles_admin_all" ON public.cpd_activity_roles;
CREATE POLICY "cpd_roles_admin_all" ON public.cpd_activity_roles
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "cpd_reasons_read" ON public.cpd_exemption_reasons;
CREATE POLICY "cpd_reasons_read" ON public.cpd_exemption_reasons
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "cpd_reasons_admin_all" ON public.cpd_exemption_reasons;
CREATE POLICY "cpd_reasons_admin_all" ON public.cpd_exemption_reasons
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 8. Báo cáo toàn sàn: gộp theo danh mục ─────────────────────────────────
-- Đổi hợp đồng trả về: course_hours → credited_hours (ĐÃ quy đổi),
-- alt_kinds → full_year_forms (tên hoạt động cho ĐẠT cả năm). Bỏ
-- records_unaccredited cùng lượt với việc bỏ cờ is_accredited_provider.
DROP FUNCTION IF EXISTS public.admin_cpd_report(INT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.admin_cpd_report(
  _year     INT,
  _province TEXT  DEFAULT NULL,
  _org_id   UUID  DEFAULT NULL,
  _q        TEXT  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rows JSONB;
  _n    INT;
  _cap  CONSTANT INT := 2000;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH people AS (
    SELECT
      a.id                AS auctioneer_id,
      a.organization_id,
      a.auction_org_id,
      a.full_name,
      a.position,
      a.license_number,
      a.license_expiry_date,
      COALESCE(o.name, ao.name, '(Chưa đặt tên)') AS org_name,
      ao.province
    FROM public.org_auctioneers a
    LEFT JOIN public.organizations        o  ON o.id  = a.organization_id
    LEFT JOIN public.auction_organizations ao ON ao.id = a.auction_org_id
    WHERE a.is_active
      AND (_org_id   IS NULL OR a.organization_id = _org_id)
      AND (_province IS NULL OR ao.province = _province)
      AND (_q IS NULL OR btrim(_q) = '' OR a.full_name ILIKE '%' || btrim(_q) || '%')
  ),
  records AS (
    SELECT
      e.auctioneer_id,
      -- Vai trò thắng hình thức khi hình thức có phân vai trò. Cùng thứ tự ưu
      -- tiên với makeCpdResolver() phía TS — hai bên phải cho ra một kết quả.
      CASE WHEN t.has_roles AND r.id IS NOT NULL THEN r.credit_mode
           ELSE t.credit_mode END AS credit_mode,
      CASE WHEN t.has_roles AND r.id IS NOT NULL THEN r.fixed_hours
           ELSE t.fixed_hours END AS fixed_hours,
      e.hours,
      t.name AS type_name,
      r.name AS role_name,
      cardinality(COALESCE(e.attachments, '{}')) AS attachment_count
    FROM public.org_auctioneer_events e
    JOIN public.cpd_activity_types t ON t.id = e.cpd_activity_type_id
    LEFT JOIN public.cpd_activity_roles r ON r.id = e.cpd_activity_role_id
    WHERE e.event_type = 'TRAINING'
      AND COALESCE(e.cpd_year, EXTRACT(YEAR FROM e.started_on)::SMALLINT) = _year::SMALLINT
  ),
  agg AS (
    SELECT
      r.auctioneer_id,
      -- Quy đổi cố định thắng số giờ khai tay; không có cả hai thì tính 0.
      COALESCE(SUM(COALESCE(r.fixed_hours, r.hours, 0))
               FILTER (WHERE r.credit_mode = 'HOURS'), 0)::NUMERIC AS credited_hours,
      COALESCE(
        ARRAY_AGG(DISTINCT COALESCE(r.type_name || ' — ' || r.role_name, r.type_name))
          FILTER (WHERE r.credit_mode = 'FULL_YEAR'),
        '{}'
      ) AS full_year_forms,
      COUNT(*)::INT AS records_total,
      COUNT(*) FILTER (WHERE r.attachment_count = 0)::INT AS records_without_proof
    FROM records r
    GROUP BY r.auctioneer_id
  )
  SELECT
    COALESCE(jsonb_agg(t ORDER BY t.org_name, t.full_name), '[]'::jsonb),
    COUNT(*)::INT
  INTO _rows, _n
  FROM (
    SELECT
      p.auctioneer_id,
      p.organization_id,
      p.auction_org_id,
      p.org_name,
      p.province,
      p.full_name,
      p.position,
      p.license_number,
      p.license_expiry_date,
      COALESCE(g.credited_hours, 0)        AS credited_hours,
      COALESCE(g.full_year_forms, '{}')    AS full_year_forms,
      COALESCE(g.records_total, 0)         AS records_total,
      COALESCE(g.records_without_proof, 0) AS records_without_proof,
      (x.id IS NOT NULL)                   AS is_exempt,
      xr.name                              AS exempt_reason
    FROM people p
    LEFT JOIN agg g ON g.auctioneer_id = p.auctioneer_id
    LEFT JOIN public.org_auctioneer_cpd_exemptions x
           ON x.auctioneer_id = p.auctioneer_id AND x.year = _year::SMALLINT
    LEFT JOIN public.cpd_exemption_reasons xr ON xr.id = x.reason_id
    ORDER BY p.org_name, p.full_name
    LIMIT _cap
  ) t;

  RETURN jsonb_build_object(
    'year', _year,
    'rows', _rows,
    'truncated', _n >= _cap,
    'cap', _cap
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_cpd_report(INT, TEXT, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
