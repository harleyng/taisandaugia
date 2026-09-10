-- Sửa backfill bị chính trigger guard nuốt ở 20260906000001.
--
-- Ở migration trước, câu UPDATE đánh dấu hồ sơ matched/contracted thành
-- 'approved' chạy SAU khi CREATE TRIGGER asset_postings_review_guard. Trong
-- migration thì auth.uid() là NULL ⇒ admin_has_permission(...) false ⇒ guard
-- gán trả review_status về OLD. UPDATE "thành công", không lỗi, không cảnh báo,
-- và 4 dòng vẫn nằm ở 'pending'.
--
-- BÀI HỌC cho mọi migration sau này đụng vào asset_postings: guard chặn MỌI
-- caller không có quyền 'duyet-tai-san'.'approve', kể cả migration và
-- service_role. Muốn ghi vào 5 cột duyệt từ phía server thì phải tắt trigger
-- tường minh như dưới đây — nếu không, thay đổi bị nuốt trong im lặng.

ALTER TABLE public.asset_postings DISABLE TRIGGER asset_postings_review_guard;

-- Hồ sơ đã đi tới bước chọn tổ chức / ký hợp đồng thì coi như đã duyệt —
-- để 'pending' là mâu thuẫn với chính dữ liệu đó (và cổng chặn ở màn chủ tài
-- sản sẽ giấu mất phần yêu cầu dịch vụ của họ).
UPDATE public.asset_postings
   SET review_status = 'approved',
       reviewed_at   = COALESCE(submitted_at, created_at)
 WHERE status IN ('matched', 'contracted')
   AND review_status = 'pending';

ALTER TABLE public.asset_postings ENABLE TRIGGER asset_postings_review_guard;
