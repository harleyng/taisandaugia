import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Đồng hồ MÁY CHỦ cho phòng đấu giá.
 *
 * Mọi mốc đóng lô (`ends_at`) do server quyết, còn đồng hồ máy người dùng có
 * thể lệch hàng phút. Nếu đếm ngược bằng Date.now() thì người xem thấy "còn
 * 30 giây" trong khi server đã đóng lô — hoặc ngược lại, ô nhập vẫn mở nhưng
 * mọi lượt trả giá đều bị từ chối `lot_closed`.
 *
 * server_now() là RPC DUY NHẤT trả timestamp trần (string), không phải JSON
 * {ok, reason} như phần còn lại của luồng đấu giá.
 *
 * Key để inline: cả chỗ đọc lẫn chỗ dùng đều nằm trong file này.
 */

const CLOCK_STALE_MS = 5 * 60_000;

/** Độ lệch (ms) giữa giờ máy chủ và giờ máy người dùng. */
export function useServerClock() {
  const { data: skewMs = 0, isSuccess } = useQuery({
    queryKey: ["server-clock"],
    staleTime: CLOCK_STALE_MS,
    queryFn: async (): Promise<number> => {
      const sentAt = Date.now();
      const { data, error } = await supabase.rpc("server_now");
      if (error) throw error;
      // Bù một nửa thời gian khứ hồi: phần còn lại của sai số nhỏ hơn nhiều so
      // với độ lệch đồng hồ mà hàm này sinh ra để sửa.
      const roundTrip = Date.now() - sentAt;
      const serverAt = Date.parse(data as unknown as string);
      if (Number.isNaN(serverAt)) return 0;
      return serverAt + roundTrip / 2 - Date.now();
    },
  });

  const now = useCallback(() => new Date(Date.now() + skewMs), [skewMs]);
  return { now, skewMs, ready: isSuccess };
}

/**
 * Giờ máy chủ ĐANG CHẠY — re-render mỗi `tickMs` để đếm ngược nhúc nhích.
 * Cùng khuôn tick + clearInterval với useCountdown trong AuctionQuickInfo,
 * chỉ khác là lấy giờ đã hiệu chỉnh thay vì Date.now().
 */
export function useServerNow(tickMs = 1000): Date {
  const { now } = useServerClock();
  const [value, setValue] = useState(() => now());

  useEffect(() => {
    setValue(now());
    const id = setInterval(() => setValue(now()), tickMs);
    return () => clearInterval(id);
  }, [now, tickMs]);

  return value;
}
