-- Đổi mã module quyền: 'duyet-tai-san' → 'tai-san-tu-nguyen'
--
-- Nhãn menu đã đổi thành "Tài sản tự nguyện" và chuyển sang nhóm Vận hành & Hỗ
-- trợ; mã module đổi theo cho khớp.
--
-- ⚠️ Mã này KHÔNG chỉ nằm ở TypeScript. Nó là chuỗi nằm trong:
--   1. 2 policy RLS trên asset_postings (20260906000001)
--   2. guard_asset_posting_review()          — trigger enforce action 'approve'
--   3. admin_dispatch_service_requests()     — RPC của luồng môi giới ký gửi
--                                              (20260906100001), DÙNG CHUNG mã
-- Đổi ở TS mà quên một trong số này ⇒ admin mất quyền đọc/ghi mà KHÔNG có lỗi
-- nào nổ ra: policy chỉ trả về 0 dòng, trigger chỉ lặng lẽ nuốt thay đổi.
--
-- AN TOÀN NGAY LÚC NÀY: admin_role_permissions đang có 0 dòng và chưa có vai trò
-- nào ngoài SUPER_ADMIN (vốn short-circuit qua fullMatrix(), không đọc bảng
-- quyền). Nên không vai trò nào mất quyền vì lần đổi mã này.

-- ─── 1. Policy RLS (policy không CREATE OR REPLACE được — phải drop rồi tạo lại) ──
DROP POLICY IF EXISTS "asset_postings_admin_read" ON public.asset_postings;
CREATE POLICY "asset_postings_admin_read"
  ON public.asset_postings FOR SELECT
  USING (public.admin_has_permission('tai-san-tu-nguyen', 'view'));

DROP POLICY IF EXISTS "asset_postings_admin_write" ON public.asset_postings;
CREATE POLICY "asset_postings_admin_write"
  ON public.asset_postings FOR UPDATE
  USING       (public.admin_has_permission('tai-san-tu-nguyen', 'update')
            OR public.admin_has_permission('tai-san-tu-nguyen', 'approve'))
  WITH CHECK  (public.admin_has_permission('tai-san-tu-nguyen', 'update')
            OR public.admin_has_permission('tai-san-tu-nguyen', 'approve'));

-- ─── 2. Hàm: viết lại TỪ ĐỊNH NGHĨA ĐANG CHẠY ────────────────────────────────
-- Cố ý KHÔNG chép tay thân hàm vào đây. admin_dispatch_service_requests là của
-- tính năng môi giới ký gửi đang làm dở song song — chép tay là nguy cơ ghi đè
-- bản mới của họ bằng bản cũ mình đọc được. pg_get_functiondef() trả về đúng
-- những gì đang chạy, chỉ thay mỗi chuỗi mã quyền.
DO $rename$
DECLARE
  r   RECORD;
  def TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) LIKE '%duyet-tai-san%'
  LOOP
    def := replace(pg_get_functiondef(r.oid), 'duyet-tai-san', 'tai-san-tu-nguyen');
    EXECUTE def;
    RAISE NOTICE 'Đã đổi mã quyền trong hàm %', r.proname;
  END LOOP;
END
$rename$;

-- ─── 3. Quyền đã cấp (hiện 0 dòng — câu này là phòng xa) ─────────────────────
UPDATE public.admin_role_permissions
   SET module = 'tai-san-tu-nguyen'
 WHERE module = 'duyet-tai-san';

-- ─── 4. Chốt chặn: không được sót tham chiếu nào ─────────────────────────────
DO $verify$
DECLARE v_left TEXT;
BEGIN
  SELECT string_agg(ref, ', ') INTO v_left FROM (
    SELECT 'policy '||policyname AS ref FROM pg_policies
     WHERE COALESCE(qual,'') LIKE '%duyet-tai-san%'
        OR COALESCE(with_check,'') LIKE '%duyet-tai-san%'
    UNION ALL
    SELECT 'function '||p.proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND pg_get_functiondef(p.oid) LIKE '%duyet-tai-san%'
    UNION ALL
    SELECT 'admin_role_permissions row' FROM public.admin_role_permissions
     WHERE module = 'duyet-tai-san'
  ) t;

  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION 'Còn sót tham chiếu mã cũ: %', v_left;
  END IF;
END
$verify$;
