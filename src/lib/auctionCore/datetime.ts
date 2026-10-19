// Mốc thời gian phiên: chuyển giữa ISO (cột timestamptz) và giá trị ô
// <input type="datetime-local"> — giờ ĐỊA PHƯƠNG của trình duyệt, không kèm múi giờ.

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → "YYYY-MM-DDTHH:mm" theo giờ địa phương. Rỗng / sai định dạng ⇒ "". */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (giờ địa phương) → ISO. Rỗng / sai định dạng ⇒ null. */
export function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  // Chuỗi ngày-giờ không có múi giờ được JS hiểu là giờ địa phương.
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "10/10/2026 09:00" — cùng cách hiển thị với AuctionCard. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Khoảng thời gian; thiếu một đầu thì chỉ nói đầu còn lại, thiếu cả hai ⇒ null. */
export function formatDateTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatDateTime(start)} – ${formatDateTime(end)}`;
  return start ? `Từ ${formatDateTime(start)}` : `Đến ${formatDateTime(end)}`;
}
