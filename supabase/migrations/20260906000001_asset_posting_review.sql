-- Duyệt tài sản chủ tài sản nộp lên (admin)
--
-- Trước migration này, asset_postings chỉ có đúng một policy own-rows nên ADMIN
-- query ra 0 dòng — không có cách nào xem, chứ chưa nói tới duyệt. Bảng cũng
-- không có trạng thái kiểm duyệt: cột `status` là vòng đời của CHỦ TÀI SẢN
-- (draft → active → matched → contracted), không phải kết quả xét duyệt.
--
-- Nên thêm `review_status` RIÊNG. Trộn hai thứ vào một cột sẽ phá cả
-- ASSET_POSTING_STATUS_LABELS lẫn luồng wizard đang chạy.
--
-- Cổng chặn: chỉ hồ sơ review_status = 'approved' mới gửi được cho tổ chức đấu giá.

-- ─── 1. Cột duyệt (theo khuôn asset_owner_kyc ở 20260603000001) ──────────────
ALTER TABLE public.asset_postings
  ADD COLUMN review_status    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (review_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN reviewed_at      TIMESTAMPTZ,
  ADD COLUMN reviewed_by      UUID REFERENCES public.profiles(id),
  ADD COLUMN rejection_reason TEXT,
  -- Ghi chú nội bộ giữa các admin — KHÔNG hiện cho chủ tài sản.
  ADD COLUMN review_notes     TEXT;

CREATE INDEX idx_asset_postings_review_status ON public.asset_postings(review_status);

-- ─── 2. RLS cho admin ────────────────────────────────────────────────────────
-- admin_has_permission() có sẵn từ 20260713000010_admin_rbac.sql và tự phủ
-- SUPER_ADMIN qua admin_is_super_admin().
CREATE POLICY "asset_postings_admin_read"
  ON public.asset_postings FOR SELECT
  USING (public.admin_has_permission('duyet-tai-san', 'view'));

-- OR 'approve' là BẮT BUỘC: người chỉ được cấp quyền duyệt mà không có quyền sửa
-- sẽ bị RLS chặn nguyên dòng — bấm Phê duyệt không ăn mà cũng không báo lỗi.
CREATE POLICY "asset_postings_admin_write"
  ON public.asset_postings FOR UPDATE
  USING       (public.admin_has_permission('duyet-tai-san', 'update')
            OR public.admin_has_permission('duyet-tai-san', 'approve'))
  WITH CHECK  (public.admin_has_permission('duyet-tai-san', 'update')
            OR public.admin_has_permission('duyet-tai-san', 'approve'));

-- ─── 3. Trigger: chỉ người có quyền 'approve' đổi được kết quả duyệt ─────────
-- Đây là chỗ action `approve` được enforce ở SERVER. RLS ở trên chỉ nói ai được
-- ghi vào dòng; trigger này nói ai được ghi vào NĂM CỘT duyệt.
CREATE OR REPLACE FUNCTION public.guard_asset_posting_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.admin_has_permission('duyet-tai-san', 'approve') THEN
    RETURN NEW;                                   -- admin có quyền duyệt: ghi thẳng
  END IF;

  -- Mọi người khác — kể cả chủ hồ sơ, kể cả admin chỉ có 'update' — không đổi
  -- được kết quả duyệt. Nuốt thay đổi thay vì RAISE: chủ tài sản sửa hồ sơ là
  -- việc hợp lệ, chỉ riêng phần kết luận duyệt là không được đụng vào.
  NEW.review_status    := OLD.review_status;
  NEW.reviewed_at      := OLD.reviewed_at;
  NEW.reviewed_by      := OLD.reviewed_by;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.review_notes     := OLD.review_notes;

  -- Sửa nội dung hồ sơ ĐÃ DUYỆT ⇒ phải duyệt lại. Không có nhánh này thì chủ
  -- tài sản được duyệt một lần rồi viết lại toàn bộ tài sản mà vẫn giữ dấu duyệt.
  IF OLD.review_status = 'approved' AND NEW.* IS DISTINCT FROM OLD.* THEN
    NEW.review_status := 'pending';
    NEW.reviewed_at   := NULL;
    NEW.reviewed_by   := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ⚠️ TÊN TRIGGER CÓ Ý NGHĨA. Bảng đã có `asset_postings_updated_at` (cũng BEFORE
-- UPDATE). Postgres chạy trigger cùng loại theo THỨ TỰ TÊN, mà
-- 'asset_postings_review_guard' < 'asset_postings_updated_at', nên guard chạy
-- trước và updated_at chưa bị đổi lúc so NEW.* IS DISTINCT FROM OLD.*.
-- Đổi tên trigger này = phép so sánh trên luôn đúng = hồ sơ đã duyệt bị đá về
-- pending mỗi lần UPDATE bất kỳ.
CREATE TRIGGER asset_postings_review_guard
  BEFORE UPDATE ON public.asset_postings
  FOR EACH ROW EXECUTE FUNCTION public.guard_asset_posting_review();

-- ─── 4. Hồ sơ seed sẵn coi như đã duyệt ──────────────────────────────────────
-- 20260623000001 seed 3 hồ sơ ở matched/contracted — chúng đã đi tới bước ký hợp
-- đồng nên để 'pending' là mâu thuẫn với chính dữ liệu đó.
UPDATE public.asset_postings
   SET review_status = 'approved',
       reviewed_at   = COALESCE(submitted_at, created_at)
 WHERE status IN ('matched', 'contracted');
