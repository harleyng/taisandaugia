/**
 * Ngày giờ trong văn bản điều khoản — GHIM múi giờ Việt Nam để kết quả trích xuất
 * không đổi theo máy người dùng (và test chạy giống nhau ở mọi TZ).
 */
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Nhãn thời gian ngắn trong danh sách tin nhắn: "09:00 20/10". */
export function formatShortDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(DATE_TIME.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.hour === "24" ? "00" : p.hour}:${p.minute} ${p.day}/${p.month}`;
}

/** "2026-10-20T02:00:00Z" → "09:00 ngày 20/10/2026". */
export function formatVnDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(DATE_TIME.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${hour}:${p.minute} ngày ${p.day}/${p.month}/${p.year}`;
}
