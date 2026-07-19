-- Seed Công việc + Ticket.
--
-- Sentinel: tasks 7a5c0001… · tickets 71c70001… · contact_submissions c05c0001…
--
-- Ghi chú kỹ thuật:
--  · closed_at của công việc đã xong đặt thẳng ở INSERT — trigger
--    tasks_sync_closed chỉ chạy BEFORE UPDATE nên không đè lên.
--  · 24 dòng contact_submissions chèn vào sẽ TỰ sinh ticket qua trigger cầu nối
--    (đó chính là phép thử luồng công khai), nên không chèn tay ticket cho chúng.
--  · Người phụ trách lấy từ profiles của một ADMIN; không có thì bỏ trống chứ
--    không rollback cả file.

-- ─── Dọn seed cũ ─────────────────────────────────────────────────────────────

DELETE FROM public.tasks   WHERE id::text LIKE '7a5c0001%';
DELETE FROM public.tickets WHERE id::text LIKE '71c70001%';
-- Xóa contact_submissions seed ⇒ ticket sinh kèm bị CASCADE theo.
DELETE FROM public.contact_submissions WHERE id::text LIKE 'c05c0001%';

-- ─── 24 liên hệ công khai (trigger tự sinh ticket) ───────────────────────────

INSERT INTO public.contact_submissions (id, name, phone, email, subject, message, status, created_at)
SELECT
  ('c05c0001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  (ARRAY['Nguyễn Văn An','Trần Thị Bình','Lê Minh Cường','Phạm Thu Dung','Vũ Đức Em',
         'Hoàng Thị Giang','Đỗ Văn Hải','Bùi Thị Hoa'])[1 + (g % 8)],
  '09' || lpad((((g * 4523) % 100000000))::text, 8, '0'),
  'lienhe' || lpad(g::text, 2, '0') || '@example.com',
  (ARRAY['Trả giá quảng cáo','Hỗ trợ tài khoản','Hợp tác dịch vụ','Hỏi về phí đấu giá',
         'Lỗi thanh toán','Tư vấn gói credit'])[1 + (g % 6)],
  'Nội dung liên hệ mẫu số ' || g || ' [crm-seed]',
  (ARRAY['unread','read','replied'])[1 + (g % 3)],
  now() - (((g * 11) % 120) || ' days')::interval
FROM generate_series(1, 24) AS g;

-- ─── 32 ticket nhập tay (ngoài 24 ticket do trigger sinh) ───────────────────

INSERT INTO public.tickets (
  id, subject, body, source, status, priority,
  requester_name, requester_phone, requester_email,
  customer_id, lead_id, resolution_note, resolved_at, created_at
)
SELECT
  ('71c70001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  (ARRAY['Yêu cầu hoàn tiền đơn hàng','Không nhận được credit sau khi nạp',
         'Đề nghị xuất hóa đơn VAT','Khiếu nại kết quả đấu giá',
         'Xin gia hạn thời gian nộp hồ sơ','Cập nhật thông tin doanh nghiệp',
         'Hỏi quy trình thẩm định giá','Báo lỗi hiển thị banner'])[1 + (g % 8)],
  'Chi tiết yêu cầu số ' || g || ' [crm-seed]',
  (ARRAY['phone','email','manual'])[1 + (g % 3)],
  CASE
    WHEN g <= 10 THEN 'new'
    WHEN g <= 22 THEN 'open'
    WHEN g <= 28 THEN 'pending'
    ELSE 'resolved'
  END,
  (ARRAY['low','normal','high','urgent'])[1 + (g % 4)],
  (ARRAY['Nguyễn Thị Kim','Trần Văn Long','Lê Thị Mai','Phạm Đức Nam'])[1 + (g % 4)],
  '09' || lpad((((g * 8171) % 100000000))::text, 8, '0'),
  'ticket' || lpad(g::text, 2, '0') || '@example.com',
  -- 8 ticket cuối cố ý KHÔNG gắn đối tượng (chạy nhánh chưa gắn).
  CASE WHEN g <= 16 THEN ('ccc00002-0000-4000-8000-' || lpad((1 + (g % 22))::text, 12, '0'))::uuid END,
  CASE WHEN g > 16 AND g <= 24 THEN ('1ead0001-0000-4000-8000-' || lpad((19 + (g % 40))::text, 12, '0'))::uuid END,
  CASE WHEN g > 28 THEN 'Đã xử lý và phản hồi khách hàng' END,
  CASE WHEN g > 28 THEN now() - (((g * 3) % 20) || ' days')::interval END,
  now() - (((g * 17) % 150) || ' days')::interval
FROM generate_series(1, 32) AS g;

-- ─── 120 công việc (30 quá hạn) ──────────────────────────────────────────────

INSERT INTO public.tasks (
  id, title, description, task_type, status, priority,
  due_at, closed_at, assignee_id,
  lead_id, customer_id, opportunity_id, created_at
)
SELECT
  ('7a5c0001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  (ARRAY['Gọi điện xác nhận nhu cầu','Gửi báo giá dịch vụ','Hẹn gặp trao đổi hợp đồng',
         'Theo dõi sau báo giá','Chuẩn bị hồ sơ pháp lý','Xác nhận thanh toán',
         'Gửi hợp đồng ký số','Nhắc gia hạn dịch vụ'])[1 + (g % 8)],
  'Nội dung công việc số ' || g || ' [crm-seed]',
  (ARRAY['call','email','meeting','followup','other'])[1 + (g % 5)],
  CASE
    WHEN g <= 48 THEN 'done'
    WHEN g <= 54 THEN 'cancelled'
    ELSE (ARRAY['todo','in_progress'])[1 + (g % 2)]
  END,
  (ARRAY['low','normal','high','urgent'])[1 + (g % 4)],
  CASE
    WHEN g <= 54  THEN now() - (((g * 7) % 90) || ' days')::interval        -- đã đóng
    WHEN g <= 84  THEN now() - (((g * 5) % 30) + 1 || ' days')::interval    -- 30 QUÁ HẠN
    ELSE now() + (((g * 3) % 45) + 1 || ' days')::interval                  -- còn hạn
  END,
  CASE WHEN g <= 54 THEN now() - (((g * 7) % 90) || ' days')::interval END,
  (SELECT p.id FROM public.profiles p
     JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'ADMIN' ORDER BY p.created_at LIMIT 1),
  -- Tối đa MỘT quan hệ (CHECK num_nonnulls <= 1); một phần để trống hoàn toàn.
  CASE WHEN g % 4 = 1 THEN ('1ead0001-0000-4000-8000-' || lpad((19 + (g % 40))::text, 12, '0'))::uuid END,
  CASE WHEN g % 4 = 2 THEN ('ccc00002-0000-4000-8000-' || lpad((1 + (g % 22))::text, 12, '0'))::uuid END,
  CASE WHEN g % 4 = 3 THEN ('0bb00001-0000-4000-8000-' || lpad((1 + (g % 72))::text, 12, '0'))::uuid END,
  now() - (((g * 13) % 180) || ' days')::interval
FROM generate_series(1, 120) AS g;

-- ─── Kiểm chứng ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tasks INTEGER; v_overdue INTEGER; v_rel INTEGER; v_tickets INTEGER; v_from_form INTEGER;
BEGIN
  SELECT count(*) INTO v_tasks FROM public.tasks WHERE id::text LIKE '7a5c0001%';
  IF v_tasks <> 120 THEN RAISE EXCEPTION 'Seed công việc: mong 120, có %', v_tasks; END IF;

  SELECT count(*) INTO v_overdue FROM public.tasks
   WHERE id::text LIKE '7a5c0001%' AND status IN ('todo','in_progress') AND due_at < now();
  IF v_overdue < 25 THEN RAISE EXCEPTION 'Seed: mong ~30 công việc quá hạn, có %', v_overdue; END IF;

  SELECT count(*) INTO v_rel FROM public.tasks
   WHERE num_nonnulls(lead_id, customer_id, opportunity_id, order_id) > 1;
  IF v_rel > 0 THEN RAISE EXCEPTION 'Seed: % công việc gắn nhiều hơn một đối tượng', v_rel; END IF;

  -- 24 ticket phải do TRIGGER sinh ra từ contact_submissions, không phải chèn tay.
  SELECT count(*) INTO v_from_form FROM public.tickets t
    JOIN public.contact_submissions cs ON cs.id = t.contact_submission_id
   WHERE cs.id::text LIKE 'c05c0001%';
  IF v_from_form <> 24 THEN
    RAISE EXCEPTION 'Trigger cầu nối hỏng: mong 24 ticket từ form, có %', v_from_form;
  END IF;

  SELECT count(*) INTO v_tickets FROM public.tickets;
  RAISE NOTICE 'Tổng ticket sau seed: %', v_tickets;
END $$;
