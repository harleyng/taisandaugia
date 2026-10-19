// Thời lượng mở lô — dùng chung cho phòng điều hành và đề xuất tư vấn đấu giá.

/** Khớp CHECK trong org_open_lot (20260913000003): 60 giây .. 24 giờ. */
export const MIN_DURATION_SECONDS = 60;
export const MAX_DURATION_SECONDS = 86_400;

/** Mốc bấm nhanh trong hộp thoại "Mở lô", tính bằng PHÚT. */
export const DURATION_PRESETS = [15, 30, 60] as const;

/** Mặc định: "đến hết phiên" thường là hàng tháng ⇒ đồng hồ vô nghĩa. */
export const DEFAULT_DURATION_MINUTES = 30;

export const minutesToSeconds = (m: number) => Math.round(m * 60);

export function isValidDurationMinutes(minutes: number): boolean {
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) return false;
  const s = minutesToSeconds(minutes);
  return s >= MIN_DURATION_SECONDS && s <= MAX_DURATION_SECONDS;
}
