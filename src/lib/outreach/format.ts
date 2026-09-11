// Định dạng dùng trong bản nháp tiếp thị. Múi giờ cố định Asia/Ho_Chi_Minh để kết
// quả tất định (test chạy ở máy nào cũng ra một chuỗi).

import { groupNumber } from "@/lib/advertising/slug";

const TZ = "Asia/Ho_Chi_Minh";

const parts = (iso: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { d: p.day, m: p.month, y: p.year, time: `${p.hour}:${p.minute}` };
};

/** "08:30 ngày 20/09/2026" */
export function viDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const { d, m, y, time } = parts(iso);
  return `${time} ngày ${d}/${m}/${y}`;
}

/** "20/09" — dùng cho SMS. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const { d, m } = parts(iso);
  return `${d}/${m}`;
}

/** "Từ 08:00 ngày 10/09/2026 đến 17:00 ngày 12/09/2026" */
export function viRange(start: string | null | undefined, end: string | null | undefined): string {
  if (start && end) return `Từ ${viDateTime(start)} đến ${viDateTime(end)}`;
  if (start) return `Từ ${viDateTime(start)}`;
  if (end) return `Đến ${viDateTime(end)}`;
  return "";
}

/** Tiền luôn tách nhóm bằng dấu phẩy (quy ước của dự án). */
export const vnd = (v: number | null | undefined): string => (v == null ? "" : `${groupNumber(v)}₫`);
export const vndAscii = (v: number | null | undefined): string => (v == null ? "" : `${groupNumber(v)}d`);
