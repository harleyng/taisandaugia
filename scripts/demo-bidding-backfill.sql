-- Đưa hồ sơ tham gia DEMO (id tiền tố f10d) về đúng luật DUYỆT HỒ SƠ (20261008100200) và
-- ĐIỂM DANH (20261008100300) sau khi chạy lại một migration seed cũ bằng psql:
--   20260912000200_seed_flow_demo           — PDG000012
--   20260913000002_seed_online_bidding_demo — PDG000013 (+ 20260914000003_seed_demo_bidder_secsosoo)
--   20260914000002_seed_post_auction_demo   — PDG000014
--
-- Các seed đó viết TRƯỚC bước duyệt + điểm danh: hồ sơ chèn lại nằm ở review_status='pending'
-- và có số báo danh mà chưa điểm danh ⇒ place_bid chặn, phòng đấu giá báo "chưa điểm danh".
-- Tệ hơn: phiên published đã qua giờ bắt đầu bị cron close_due_rosters chốt trong vòng 1 phút
-- ⇒ hồ sơ chưa điểm danh bị đánh VẮNG và tịch thu tiền đặt trước. Vì vậy chạy file này CÙNG
-- GIAO DỊCH với seed (psql -1 bọc mọi -f trong một BEGIN … COMMIT):
--
--   psql "$DB" -X -1 -v ON_ERROR_STOP=1 \
--     -f supabase/migrations/20260913000002_seed_online_bidding_demo.sql \
--     -f supabase/migrations/20260914000003_seed_demo_bidder_secsosoo.sql \
--     -f scripts/demo-bidding-backfill.sql
--
-- CHỈ chạm hồ sơ f10d — hồ sơ thật đang chờ duyệt KHÔNG được duyệt hộ. Idempotent.
-- Seed mới (scripts/seed-*.py) phải tự đặt review_status / checked_in_at, đừng dựa vào file này.

-- ── 1. Duyệt ──────────────────────────────────────────────────────────────────
-- Khoá duyệt chặn đổi review_status khi phiên đã chốt danh sách (PDG000013/14) ⇒ tắt tạm.
ALTER TABLE public.auction_bidding_contracts DISABLE TRIGGER auction_bidding_contracts_review_lock;

UPDATE public.auction_bidding_contracts
   SET review_status = 'approved', reviewed_at = COALESCE(reviewed_at, paid_at)
 WHERE id::text LIKE 'f10d%' AND status = 'paid' AND review_status = 'pending';

ALTER TABLE public.auction_bidding_contracts ENABLE TRIGGER auction_bidding_contracts_review_lock;

-- Insert thẳng 'paid' không qua trigger 'submitted' ⇒ tự ghi lịch sử (bảng chỉ-ghi-thêm, chỉ INSERT).
INSERT INTO public.auction_contract_review_events (contract_id, kind, note, actor_id, at)
SELECT c.id, 'submitted', NULL, c.user_id, c.paid_at
  FROM public.auction_bidding_contracts c
 WHERE c.id::text LIKE 'f10d%' AND c.status = 'paid'
   AND NOT EXISTS (SELECT 1 FROM public.auction_contract_review_events e
                    WHERE e.contract_id = c.id AND e.kind = 'submitted');

INSERT INTO public.auction_contract_review_events (contract_id, kind, note, actor_id, at)
SELECT c.id, 'approved', 'Dữ liệu mẫu — hồ sơ hợp lệ.', NULL, c.reviewed_at + interval '1 second'
  FROM public.auction_bidding_contracts c
 WHERE c.id::text LIKE 'f10d%' AND c.status = 'paid' AND c.review_status = 'approved'
   AND NOT EXISTS (SELECT 1 FROM public.auction_contract_review_events e
                    WHERE e.contract_id = c.id AND e.kind = 'approved');

-- ── 2. Điểm danh ──────────────────────────────────────────────────────────────
-- Như backfill của 20261008100300: có số báo danh = đã điểm danh, người ủy quyền tự đến.
UPDATE public.auction_bidding_contracts c
   SET checked_in_at    = COALESCE(c.bidder_no_assigned_at, c.paid_at, c.created_at),
       checkin_channel  = CASE WHEN s.auction_format = 'truc_tiep' THEN 'onsite' ELSE 'online' END,
       checkin_attendee = 'principal'
  FROM public.auction_sessions s
 WHERE s.id = c.session_id AND c.id::text LIKE 'f10d%'
   AND c.bidder_no IS NOT NULL AND c.checked_in_at IS NULL AND c.absent_at IS NULL;

-- ── 3. Kiểm ───────────────────────────────────────────────────────────────────
DO $check$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM public.auction_bidding_contracts
   WHERE id::text LIKE 'f10d%' AND status = 'paid' AND review_status = 'pending';
  IF v_n > 0 THEN RAISE EXCEPTION 'Còn % hồ sơ demo đã trả mà chưa duyệt', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.auction_bidding_contracts
   WHERE id::text LIKE 'f10d%' AND bidder_no IS NOT NULL AND checked_in_at IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Còn % hồ sơ demo có số báo danh mà chưa điểm danh (đã bị đánh vắng? — gỡ seed và chạy lại cùng giao dịch)', v_n;
  END IF;
END $check$;
