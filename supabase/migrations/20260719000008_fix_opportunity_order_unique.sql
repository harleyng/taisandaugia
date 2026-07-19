-- Sửa bất biến "một cơ hội ↔ một đơn" cho đúng nghĩa.
--
-- idx_orders_opportunity ban đầu là UNIQUE trên MỌI đơn có opportunity_id, nên
-- chu trình bỏ chốt → chốt lại bị chặn: admin_unwin_opportunity chuyển đơn cũ
-- sang 'cancelled' (cố ý GIỮ dấu vết kế toán, không xóa) nhưng dòng đó vẫn
-- chiếm chỗ trong index, làm admin_win_opportunity không insert được đơn mới.
--
-- Bất biến thật sự cần: một cơ hội có tối đa một đơn HIỆU LỰC. Đơn đã hủy là
-- lịch sử, được phép tồn tại nhiều bản.

DROP INDEX IF EXISTS public.idx_orders_opportunity;

CREATE UNIQUE INDEX idx_orders_opportunity_active
  ON public.orders (opportunity_id)
  WHERE opportunity_id IS NOT NULL AND fulfillment_status <> 'cancelled';

-- Tra cứu lịch sử đơn theo cơ hội (kể cả đơn đã hủy).
CREATE INDEX IF NOT EXISTS idx_orders_opportunity_all
  ON public.orders (opportunity_id) WHERE opportunity_id IS NOT NULL;
