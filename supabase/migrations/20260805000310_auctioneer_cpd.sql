-- ─────────────────────────────────────────────────────────────────────────────
-- Bồi dưỡng chuyên môn, nghiệp vụ hằng năm của đấu giá viên
-- Căn cứ: Thông tư 19/2024/TT-BTP (hiệu lực 01/01/2025)
--
--   Điều 26.1 — tối thiểu 8 giờ/năm (01 ngày làm việc/năm)
--   Điều 24.3 — hình thức: lớp bồi dưỡng hoặc trao đổi kinh nghiệm hành nghề
--   Điều 25   — đơn vị tổ chức: tổ chức xã hội-nghề nghiệp của ĐGV, Học viện Tư
--               pháp, Cục Bổ trợ tư pháp
--   Điều 26.2 — các hoạt động ĐƯỢC TÍNH LÀ HOÀN THÀNH nghĩa vụ dù không đủ giờ:
--               giảng dạy về đấu giá, có bài/sách/giáo trình đã công bố, tham gia
--               khoá bồi dưỡng ở nước ngoài, làm báo cáo viên tại hội thảo/toạ đàm
--   Điều 26.3 — miễn: nữ mang thai hoặc nuôi con dưới 12 tháng; điều trị bệnh dài
--               ngày ≥3 tháng. Nộp giấy tờ cho Sở Tư pháp chậm nhất 15/12.
--   Điều 27   — giấy tờ xác nhận; Sở Tư pháp đăng danh sách chậm nhất 31/12.
--
-- CHỦ TRƯƠNG: mở rộng tại chỗ, KHÔNG dựng bảng ledger song song. Sự kiện bồi
-- dưỡng đã sống ở org_auctioneer_events (event_type='TRAINING', cột hours) và đã
-- được in ra hồ sơ kết xuất (dossier-content.ts mục VI + VII). Cái thiếu là NGỮ
-- NGHĨA — năm được tính, loại hình thức, đơn vị có được công nhận không — nên chỉ
-- thêm cột. Riêng miễn trừ là thực thể khác hẳn (gắn với NĂM, không gắn với một
-- hoạt động, mỗi người mỗi năm tối đa một bản) nên tách bảng.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Ngữ nghĩa bồi dưỡng trên sự kiện ────────────────────────────────────
ALTER TABLE public.org_auctioneer_events
  -- Năm được tính nghĩa vụ. Tách khỏi started_on vì khoá có thể vắt qua năm, và
  -- vì bản ghi không có ngày trước nay rơi vào hư không (trainingCompliance()
  -- lọc bằng cách cắt chuỗi startedOn.slice(0,4)).
  ADD COLUMN IF NOT EXISTS cpd_year SMALLINT
    CHECK (cpd_year IS NULL OR cpd_year BETWEEN 2000 AND 2100),

  -- NULL = bản ghi đào tạo KHÔNG thuộc diện bồi dưỡng bắt buộc (vd chứng chỉ tốt
  -- nghiệp đào tạo nghề đấu giá) ⇒ không tính vào nghĩa vụ hằng năm.
  --   COURSE          — lớp bồi dưỡng / trao đổi kinh nghiệm (Điều 24.3), tính GIỜ
  --   TEACHING        — giảng dạy về đấu giá tài sản          ─┐
  --   PUBLICATION     — bài đăng tạp chí, sách, giáo trình      │ Điều 26.2:
  --   OVERSEAS_COURSE — khoá bồi dưỡng ở nước ngoài             │ ĐẠT bất kể giờ
  --   SPEAKER         — báo cáo viên hội thảo/toạ đàm/diễn đàn ─┘
  ADD COLUMN IF NOT EXISTS cpd_kind TEXT
    CHECK (cpd_kind IS NULL OR cpd_kind IN (
      'COURSE', 'TEACHING', 'PUBLICATION', 'OVERSEAS_COURSE', 'SPEAKER'
    )),

  -- Đơn vị tổ chức có thuộc Điều 25 không. GẮN CỜ, KHÔNG TỰ LOẠI: tính hợp lệ
  -- pháp lý do Sở Tư pháp phán, hệ thống chỉ cảnh báo mềm.
  ADD COLUMN IF NOT EXISTS is_accredited_provider BOOLEAN NOT NULL DEFAULT false;

-- Backfill BẢO TOÀN HÀNH VI: mọi dòng TRAINING đang có ngày phải cho ra đúng số
-- giờ như trước migration, nếu không người dùng đột ngột "mất giờ" đã khai.
UPDATE public.org_auctioneer_events
   SET cpd_year = EXTRACT(YEAR FROM started_on)::SMALLINT
 WHERE event_type = 'TRAINING' AND started_on IS NOT NULL AND cpd_year IS NULL;

UPDATE public.org_auctioneer_events
   SET cpd_kind = 'COURSE'
 WHERE event_type = 'TRAINING' AND cpd_kind IS NULL;

-- Truy vấn nóng của trang tổng hợp: "mọi bản ghi bồi dưỡng của tổ chức, năm N".
CREATE INDEX IF NOT EXISTS idx_oae_cpd
  ON public.org_auctioneer_events (organization_id, cpd_year)
  WHERE event_type = 'TRAINING';

COMMENT ON COLUMN public.org_auctioneer_events.cpd_year IS
  'Năm được tính nghĩa vụ bồi dưỡng (TT 19/2024/TT-BTP). Mặc định = năm của started_on, sửa được khi khoá vắt qua năm.';
COMMENT ON COLUMN public.org_auctioneer_events.cpd_kind IS
  'COURSE = lớp bồi dưỡng (tính giờ). TEACHING/PUBLICATION/OVERSEAS_COURSE/SPEAKER = hình thức thay thế Điều 26.2, đạt bất kể số giờ. NULL = không thuộc diện bồi dưỡng bắt buộc.';
COMMENT ON COLUMN public.org_auctioneer_events.is_accredited_provider IS
  'Đơn vị tổ chức thuộc Điều 25 TT 19/2024/TT-BTP. Cảnh báo mềm khi false — KHÔNG loại bản ghi.';

-- ─── 2. Miễn nghĩa vụ bồi dưỡng (Điều 26.3) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_auctioneer_cpd_exemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auctioneer_id UUID NOT NULL REFERENCES public.org_auctioneers(id) ON DELETE CASCADE,
  -- Denormalize để policy chỉ là một lời gọi hàm, không join ngược về cha —
  -- cùng khuôn với org_auctioneer_documents / org_auctioneer_events.
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  year   SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  reason TEXT NOT NULL CHECK (reason IN (
    'MATERNITY',    -- nữ mang thai hoặc nuôi con dưới 12 tháng tuổi
    'LONG_ILLNESS', -- điều trị bệnh dài ngày ≥3 tháng theo danh mục Bộ Y tế
    'OTHER'
  )),
  note TEXT,

  -- Ngày đã nộp giấy tờ cho Sở Tư pháp. Hạn luật định: 15/12 hằng năm.
  filed_at    DATE,
  attachments TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Mỗi người mỗi năm tối đa một bản miễn.
  CONSTRAINT uq_cpd_exemption_person_year UNIQUE (auctioneer_id, year)
);

CREATE INDEX IF NOT EXISTS idx_cpd_exemption_org_year
  ON public.org_auctioneer_cpd_exemptions (organization_id, year);

DROP TRIGGER IF EXISTS cpd_exemption_updated_at ON public.org_auctioneer_cpd_exemptions;
CREATE TRIGGER cpd_exemption_updated_at BEFORE UPDATE ON public.org_auctioneer_cpd_exemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. Gate quyền ──────────────────────────────────────────────────────────
-- Là TẬP CHA của can_manage_org_auctioneers ⇒ không ai mất quyền sau migration.
--
-- LƯU Ý về một đường nối có sẵn từ trước: bảng roster org_auctioneers vẫn chỉ mở
-- qua 'nl-dau-gia-vien'. Trang bồi dưỡng phải đọc roster để hiện tên người, nên
-- cấp riêng lẻ 'boi-duong' cho một vai trò KHÔNG có 'nl-dau-gia-vien:view' sẽ ra
-- bảng rỗng. Backfill dưới đây cố ý gắn hai mã đi cùng nhau. Mục 'nhan-su'
-- (20260805000040) cũng đang ở tình trạng y hệt — migration này bám theo hiện
-- trạng, không mở rộng phạm vi để sửa.
CREATE OR REPLACE FUNCTION public.can_manage_org_cpd(_org_id UUID, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'boi-duong', _action)
      OR public.can_manage_org_auctioneers(_org_id, _action)
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_org_cpd(UUID, TEXT) TO authenticated;

-- ─── 4. RLS cho bảng miễn trừ ───────────────────────────────────────────────
ALTER TABLE public.org_auctioneer_cpd_exemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cpd_ex_select" ON public.org_auctioneer_cpd_exemptions;
CREATE POLICY "cpd_ex_select" ON public.org_auctioneer_cpd_exemptions
  FOR SELECT TO authenticated
  USING (public.can_manage_org_cpd(organization_id, 'view'));

DROP POLICY IF EXISTS "cpd_ex_insert" ON public.org_auctioneer_cpd_exemptions;
CREATE POLICY "cpd_ex_insert" ON public.org_auctioneer_cpd_exemptions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_cpd(organization_id, 'create'));

DROP POLICY IF EXISTS "cpd_ex_update" ON public.org_auctioneer_cpd_exemptions;
CREATE POLICY "cpd_ex_update" ON public.org_auctioneer_cpd_exemptions
  FOR UPDATE TO authenticated
  USING (public.can_manage_org_cpd(organization_id, 'update'))
  WITH CHECK (public.can_manage_org_cpd(organization_id, 'update'));

DROP POLICY IF EXISTS "cpd_ex_delete" ON public.org_auctioneer_cpd_exemptions;
CREATE POLICY "cpd_ex_delete" ON public.org_auctioneer_cpd_exemptions
  FOR DELETE TO authenticated
  USING (public.can_manage_org_cpd(organization_id, 'delete'));

DROP POLICY IF EXISTS "cpd_ex_admin_all" ON public.org_auctioneer_cpd_exemptions;
CREATE POLICY "cpd_ex_admin_all" ON public.org_auctioneer_cpd_exemptions
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── 5. Nới RLS sự kiện cho người chỉ có quyền bồi dưỡng ────────────────────
-- Điều kiện lọc theo event_type để người có 'boi-duong' chạm được ĐÚNG dòng
-- TRAINING, không thấy WORK / REWARD / DISCIPLINE.
DROP POLICY IF EXISTS "oae_select" ON public.org_auctioneer_events;
CREATE POLICY "oae_select" ON public.org_auctioneer_events
  FOR SELECT TO authenticated
  USING (
    public.can_manage_org_auctioneers(organization_id, 'view')
    OR (event_type = 'TRAINING' AND public.can_manage_org_cpd(organization_id, 'view'))
  );

DROP POLICY IF EXISTS "oae_insert" ON public.org_auctioneer_events;
CREATE POLICY "oae_insert" ON public.org_auctioneer_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_org_auctioneers(organization_id, 'create')
    OR (event_type = 'TRAINING' AND public.can_manage_org_cpd(organization_id, 'create'))
  );

DROP POLICY IF EXISTS "oae_update" ON public.org_auctioneer_events;
CREATE POLICY "oae_update" ON public.org_auctioneer_events
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_org_auctioneers(organization_id, 'update')
    OR (event_type = 'TRAINING' AND public.can_manage_org_cpd(organization_id, 'update'))
  )
  WITH CHECK (
    public.can_manage_org_auctioneers(organization_id, 'update')
    OR (event_type = 'TRAINING' AND public.can_manage_org_cpd(organization_id, 'update'))
  );

DROP POLICY IF EXISTS "oae_delete" ON public.org_auctioneer_events;
CREATE POLICY "oae_delete" ON public.org_auctioneer_events
  FOR DELETE TO authenticated
  USING (
    public.can_manage_org_auctioneers(organization_id, 'delete')
    OR (event_type = 'TRAINING' AND public.can_manage_org_cpd(organization_id, 'delete'))
  );

-- ─── 6. Quyền tổ chức: mã mới 'boi-duong' ───────────────────────────────────
-- BẢO TOÀN HÀNH VI là ràng buộc chính (cùng lý lẽ với 20260805000040): ai đang
-- ghi được sự kiện TRAINING chính là người có quyền trên 'nl-dau-gia-vien', nên
-- map 1-1 sang mã mới. 'export' = xuất CSV danh sách tuân thủ, KHÔNG trừ credit,
-- nên cấp kèm cho ai xem được.
INSERT INTO public.org_role_permissions (role_id, module, action)
SELECT p.role_id, 'boi-duong', v.action
FROM public.org_role_permissions p
JOIN (VALUES
  ('view',   'view'),
  ('view',   'export'),
  ('create', 'create'),
  ('update', 'update'),
  ('delete', 'delete')
) AS v(src_action, action) ON v.src_action = p.action
WHERE p.module = 'nl-dau-gia-vien'
ON CONFLICT (role_id, module, action) DO NOTHING;

-- Tổ chức tạo MỚI cũng phải có preset tương ứng.
CREATE OR REPLACE FUNCTION public.org_seed_default_roles(_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    ('AGENT','tin-dang','view'),               ('AGENT','tin-dang','create')
  ) AS v(code, module, action) ON v.code = r.code
  WHERE r.organization_id = _org_id
  ON CONFLICT (role_id, module, action) DO NOTHING;

  RETURN _owner_role_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.org_seed_default_roles(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
