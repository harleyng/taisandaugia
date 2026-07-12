-- Sửa dữ liệu seed đã áp: migration 20260713000002 (bản đầu) tính device_type
-- trong một subquery non-correlated nên Postgres cache random() → 100% 'mobile'.
-- Ở đây phân bổ lại device_type + os THEO TỪNG SESSION (nhất quán trong 1 phiên),
-- với random() đặt trong SELECT list cấp dòng để đánh giá theo-dòng.
-- Idempotent & vô hại nếu chạy trên seed đã đúng (chỉ re-roll phân bố hợp lệ).

WITH sess AS (
  SELECT
    session_id,
    (ARRAY['mobile','mobile','mobile','mobile','mobile','mobile',
           'desktop','desktop','desktop','tablet'])[1 + floor(random() * 10)::int] AS dt
  FROM (SELECT DISTINCT session_id FROM public.analytics_events) s
),
sess_os AS (
  SELECT
    session_id,
    dt,
    CASE dt
      WHEN 'mobile' THEN (ARRAY['iOS','Android','Android'])[1 + floor(random() * 3)::int]
      WHEN 'tablet' THEN (ARRAY['iPadOS','Android'])[1 + floor(random() * 2)::int]
      ELSE (ARRAY['Windows','Windows','macOS'])[1 + floor(random() * 3)::int]
    END AS os
  FROM sess
)
UPDATE public.analytics_events ae
SET device_type = so.dt,
    os          = so.os
FROM sess_os so
WHERE ae.session_id = so.session_id;
