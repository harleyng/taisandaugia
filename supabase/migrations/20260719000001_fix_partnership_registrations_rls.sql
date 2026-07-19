-- Vá bảo mật: partnership_registrations đang mở toang.
--
-- 20260521000002 tạo bảng với 2 policy "service role can select" / "service role
-- can update" dùng USING (true) — tên policy gợi ý ý định là service_role, nhưng
-- USING (true) áp cho MỌI role đã đăng nhập (anon + authenticated), nên bất kỳ
-- người mua nào cũng ĐỌC và SỬA được tên/SĐT/email/ghi chú của toàn bộ đơn vị
-- đăng ký hợp tác.
--
-- Siết về admin theo chuẩn has_role như mọi bảng back-office khác. Giữ nguyên
-- policy INSERT: form công khai (CollaborationDialog) gọi .insert() KHÔNG kèm
-- .select() nên không cần quyền đọc.

-- ─── partnership_registrations (Đăng ký hợp tác) ─────────────────────────────

DROP POLICY IF EXISTS "service role can select" ON public.partnership_registrations;
DROP POLICY IF EXISTS "service role can update" ON public.partnership_registrations;

CREATE POLICY "partnership_registrations_admin_read"
  ON public.partnership_registrations FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "partnership_registrations_admin_update"
  ON public.partnership_registrations FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE INDEX IF NOT EXISTS idx_partnership_registrations_status
  ON public.partnership_registrations (status, created_at DESC);
