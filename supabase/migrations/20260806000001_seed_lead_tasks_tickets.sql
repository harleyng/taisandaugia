-- Seed Công việc + Ticket cho KHÁCH HÀNG TIỀM NĂNG (tab mới ở trang chi tiết).
--
-- Vì sao cần: seed CRM trước (20260719000011) chỉ gắn vào một nhúm lead cố
-- định — 10/103 lead có việc (nhiều nhất 3) và 8 lead có đúng 1 ticket, nên
-- tab mở ra gần như trống, không thấy được nhóm theo hạn lẫn phân trang.
--
-- Sentinel RIÊNG: tasks 7a5c0002… · tickets 71c70002… (seed cũ 7a5c0001…/
-- 71c70001… giữ nguyên, không đụng vào).
--
-- Ghi chú kỹ thuật:
--  · Chọn lead bằng row_number() OVER (ORDER BY created_at DESC) — đúng thứ tự
--    danh sách ở /admin/khach-hang-tiem-nang, nên lead mở đầu tiên là lead có
--    dữ liệu. KHÔNG hardcode UUID: lead ở DB này phần lớn sinh từ dữ liệu sàn.
--  · Không dùng random(): mọi giá trị suy từ (rn, s) nên chạy lại cho cùng kết
--    quả; id suy ra từ (rn, s) + DELETE đầu file ⇒ idempotent.
--  · closed_at đặt thẳng ở INSERT — trigger tasks_sync_closed chỉ BEFORE UPDATE.
--  · Ticket seed chỉ dùng nguồn phone/email/manual. contact_form và partnership
--    phải đi kèm bản ghi intake gốc (cột UNIQUE + trigger cầu nối), bịa ra sẽ
--    thành ticket "từ website" mà không có form nào phía sau.
--  · Phân bổ: 8 lead mới nhất 16 việc + 7 ticket (đủ >5 dòng/nhóm để chạm phân
--    trang), 22 lead kế 3 việc + 2 ticket, còn lại để TRỐNG (vẫn kiểm được
--    trạng thái rỗng).

-- ─── Dọn seed cũ của chính file này ──────────────────────────────────────────

DELETE FROM public.tasks   WHERE id::text LIKE '7a5c0002%';
DELETE FROM public.tickets WHERE id::text LIKE '71c70002%';

-- ─── Công việc ───────────────────────────────────────────────────────────────

WITH pick AS (
  SELECT l.id, l.name, row_number() OVER (ORDER BY l.created_at DESC, l.id) AS rn
  FROM public.leads l
),
target AS (
  SELECT p.*, CASE WHEN p.rn <= 8 THEN 16 WHEN p.rn <= 30 THEN 3 ELSE 0 END AS n_task
  FROM pick p
),
admin_pool AS (
  SELECT pr.id, row_number() OVER (ORDER BY pr.created_at, pr.id) AS an
  FROM public.profiles pr
  JOIN public.user_roles ur ON ur.user_id = pr.id
  WHERE ur.role = 'ADMIN'
),
admin_n AS (SELECT GREATEST(count(*), 1) AS n FROM admin_pool)
INSERT INTO public.tasks (
  id, title, description, task_type, status, priority,
  due_at, closed_at, assignee_id, lead_id, created_at
)
SELECT
  ('7a5c0002-0000-4000-8000-' || lpad((t.rn * 100 + s)::text, 12, '0'))::uuid,
  (ARRAY['Gọi cho khách hàng và giới thiệu gói dịch vụ',
         'Gửi báo giá đăng tin đấu giá',
         'Hẹn gặp trao đổi hợp đồng hợp tác',
         'Theo dõi sau báo giá',
         'Xác minh thông tin pháp nhân',
         'Tư vấn quy trình niêm yết tài sản',
         'Nhắc khách bổ sung hồ sơ năng lực',
         'Chốt lịch demo cổng đấu giá',
         'Gọi lại theo hẹn của khách',
         'Gửi tài liệu so sánh gói credit'])[1 + ((t.rn + s) % 10)],
  'Ghi chú làm việc với ' || t.name || ' [lead-seed]',
  (ARRAY['call','email','meeting','followup','other'])[1 + ((t.rn + s) % 5)],
  CASE
    WHEN b.bucket = 'closed' THEN CASE WHEN s % 2 = 0 THEN 'cancelled' ELSE 'done' END
    WHEN b.bucket = 'today'  THEN 'todo'
    ELSE (ARRAY['todo','in_progress'])[1 + ((t.rn + s) % 2)]
  END,
  (ARRAY['low','normal','high','urgent'])[1 + ((t.rn * 3 + s) % 4)],
  CASE b.bucket
    WHEN 'overdue'  THEN now() - ((((t.rn + s * 3) % 21) + 1) || ' days')::interval
    WHEN 'today'    THEN date_trunc('day', now()) + ((8 + s) || ' hours')::interval
    WHEN 'upcoming' THEN now() + ((((t.rn + s) % 30) + 1) || ' days')::interval
    ELSE                 now() - ((((t.rn * 2 + s) % 60) + 3) || ' days')::interval
  END,
  CASE WHEN b.bucket = 'closed'
       THEN now() - ((((t.rn * 2 + s) % 60) + 3) || ' days')::interval END,
  a.id,
  t.id,
  now() - ((((t.rn * 5 + s * 7) % 120) + 1) || ' days')::interval
FROM target t
CROSS JOIN generate_series(1, t.n_task) AS s
CROSS JOIN LATERAL (
  SELECT CASE
    -- Lead "thưa" chỉ 3 việc: mỗi việc một nhóm khác nhau.
    WHEN t.n_task = 3 THEN (ARRAY['overdue','upcoming','closed'])[s]
    WHEN s <= 6  THEN 'overdue'
    WHEN s <= 8  THEN 'today'
    WHEN s <= 14 THEN 'upcoming'
    ELSE 'closed'
  END AS bucket
) b
LEFT JOIN admin_pool a ON a.an = 1 + ((t.rn + s) % (SELECT n FROM admin_n));

-- ─── Ticket ──────────────────────────────────────────────────────────────────

WITH pick AS (
  SELECT l.id, l.name, l.phone, l.email, l.contact_name,
         row_number() OVER (ORDER BY l.created_at DESC, l.id) AS rn
  FROM public.leads l
),
target AS (
  SELECT p.*, CASE WHEN p.rn <= 8 THEN 7 WHEN p.rn <= 30 THEN 2 ELSE 0 END AS n_ticket
  FROM pick p
),
admin_pool AS (
  SELECT pr.id, row_number() OVER (ORDER BY pr.created_at, pr.id) AS an
  FROM public.profiles pr
  JOIN public.user_roles ur ON ur.user_id = pr.id
  WHERE ur.role = 'ADMIN'
),
admin_n AS (SELECT GREATEST(count(*), 1) AS n FROM admin_pool)
INSERT INTO public.tickets (
  id, subject, body, source, status, priority,
  requester_name, requester_phone, requester_email,
  assignee_id, lead_id, resolution_note, resolved_at, first_response_at, created_at
)
SELECT
  ('71c70002-0000-4000-8000-' || lpad((t.rn * 100 + s)::text, 12, '0'))::uuid,
  (ARRAY['Hỏi quy trình đăng tin đấu giá',
         'Đề nghị xuất hóa đơn VAT',
         'Không đăng nhập được tài khoản tổ chức',
         'Xin gia hạn thời gian nộp hồ sơ',
         'Hỏi phí niêm yết tài sản',
         'Đề nghị chỉnh sửa thông tin phiên đấu giá',
         'Báo lỗi tải lên hồ sơ năng lực'])[1 + ((t.rn + s) % 7)],
  'Yêu cầu từ ' || t.name || ' [lead-seed]',
  (ARRAY['phone','email','manual'])[1 + ((t.rn + s) % 3)],
  st.status,
  (ARRAY['low','normal','high','urgent'])[1 + ((t.rn * 2 + s) % 4)],
  COALESCE(NULLIF(t.contact_name, ''), 'Người liên hệ ' || t.name),
  COALESCE(NULLIF(t.phone, ''), '09' || lpad((((t.rn * 7919 + s) % 100000000))::text, 8, '0')),
  NULLIF(t.email, ''),
  a.id,
  t.id,
  CASE WHEN st.status IN ('resolved','closed') THEN 'Đã xử lý và phản hồi khách hàng' END,
  CASE WHEN st.status IN ('resolved','closed')
       THEN now() - ((((t.rn + s) % 15) + 1) || ' days')::interval END,
  -- Ticket 'new' chưa ai chạm ⇒ chưa có mốc phản hồi đầu tiên (giữ SLA thật).
  CASE WHEN st.status <> 'new'
       THEN now() - ((((t.rn + s) % 25) + 2) || ' days')::interval END,
  now() - ((((t.rn * 11 + s * 5) % 100) + 1) || ' days')::interval
FROM target t
CROSS JOIN generate_series(1, t.n_ticket) AS s
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN t.n_ticket = 2 THEN (ARRAY['open','resolved'])[s]
    ELSE (ARRAY['new','new','open','open','pending','resolved','closed'])[s]
  END AS status
) st
LEFT JOIN admin_pool a ON a.an = 1 + ((t.rn + s) % (SELECT n FROM admin_n));

-- ─── Kiểm chứng ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_leads INTEGER; v_exp_task INTEGER; v_exp_ticket INTEGER;
  v_task INTEGER; v_ticket INTEGER; v_rel INTEGER; v_thin INTEGER;
BEGIN
  SELECT count(*) INTO v_leads FROM public.leads;
  v_exp_task   := 16 * LEAST(v_leads, 8) + 3 * GREATEST(LEAST(v_leads, 30) - 8, 0);
  v_exp_ticket :=  7 * LEAST(v_leads, 8) + 2 * GREATEST(LEAST(v_leads, 30) - 8, 0);

  SELECT count(*) INTO v_task   FROM public.tasks   WHERE id::text LIKE '7a5c0002%';
  SELECT count(*) INTO v_ticket FROM public.tickets WHERE id::text LIKE '71c70002%';
  IF v_task   <> v_exp_task   THEN RAISE EXCEPTION 'Seed việc: mong %, có %',   v_exp_task, v_task; END IF;
  IF v_ticket <> v_exp_ticket THEN RAISE EXCEPTION 'Seed ticket: mong %, có %', v_exp_ticket, v_ticket; END IF;

  SELECT count(*) INTO v_rel FROM public.tasks
   WHERE id::text LIKE '7a5c0002%' AND num_nonnulls(lead_id, customer_id, opportunity_id, order_id) <> 1;
  IF v_rel > 0 THEN RAISE EXCEPTION 'Seed: % công việc không gắn đúng một lead', v_rel; END IF;

  -- Mỗi lead "dày" phải có >5 việc quá hạn — chính là điều kiện chạm phân trang.
  SELECT count(*) INTO v_thin FROM (
    SELECT lead_id FROM public.tasks
     WHERE id::text LIKE '7a5c0002%' AND status IN ('todo','in_progress') AND due_at < now()
     GROUP BY lead_id HAVING count(*) > 5
  ) s;
  IF v_thin < LEAST(v_leads, 8) THEN
    RAISE EXCEPTION 'Seed: mong % lead có >5 việc quá hạn, có %', LEAST(v_leads, 8), v_thin;
  END IF;

  RAISE NOTICE 'Seed lead CRM: % công việc, % ticket', v_task, v_ticket;
END $$;
