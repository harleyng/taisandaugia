// Định dạng đồng hồ đếm ngược của phòng đấu giá.
//
// Hàm THUẦN, chỉ nhận số mili-giây còn lại (lấy từ remainingMs() + giờ máy chủ).
// KHÔNG được gọi Date.now() ở đây: giờ trong phòng đấu giá luôn là giờ máy chủ
// đã bù lệch (useServerClock), lấy giờ máy người dùng là hiện sai mốc đóng lô.
//
// Định dạng đổi theo độ dài còn lại (người dùng chọn 2026-09-12): mốc đóng còn
// hơn một ngày mà hiện "2640:15:03" thì vô nghĩa, nên đổi sang đếm theo ngày và
// kèm mốc tuyệt đối; càng gần giờ đóng thì càng chi tiết và càng gắt.

export type CountdownUrgency = "normal" | "soon" | "urgent";

export interface Countdown {
  text: string;
  urgency: CountdownUrgency;
  /** Thẻ nên hiện thêm "Đóng lúc {ends_at}" vì con số tương đối quá thô. */
  showAbsolute: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Ngưỡng "sắp đóng" — cũng là mặc định của extension_seconds (300 giây). */
export const URGENT_MS = 5 * MINUTE;
const SOON_MS = HOUR;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `null` khi lô chưa có mốc đóng (chưa mở / đã rút) — thẻ hiện "—" chứ không
 * hiện số 0, vì 0 nghĩa là ĐÃ hết giờ.
 */
export function formatCountdown(ms: number | null): Countdown | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  if (ms <= 0) return { text: "Đã hết giờ", urgency: "urgent", showAbsolute: false };

  if (ms >= DAY) {
    // Làm tròn LÊN: còn 1 ngày rưỡi thì "còn 2 ngày" vẫn đúng tinh thần hơn là
    // "còn 1 ngày" khi thực tế gần 2.
    const days = Math.ceil(ms / DAY);
    return { text: `còn ${days} ngày`, urgency: "normal", showAbsolute: true };
  }

  const totalSeconds = Math.floor(ms / SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (ms >= SOON_MS) {
    return { text: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, urgency: "normal", showAbsolute: true };
  }

  const text = `${pad(minutes)}:${pad(seconds)}`;
  return { text, urgency: ms < URGENT_MS ? "urgent" : "soon", showAbsolute: false };
}
