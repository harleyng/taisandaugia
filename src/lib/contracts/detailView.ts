// Dạng hiển thị CHUNG của trang chi tiết hợp đồng trong cổng chủ tài sản (design "Hop
// Dong - Danh sach & Chi tiet"): thanh 4 bước → thẻ "việc tiếp theo" (kèm bảng điều
// khoản / lịch thu / phạm vi) → tài liệu | tóm tắt → hoạt động. Ba loại hợp đồng dựng
// về dạng này ở consignmentView / saleView / serviceView. THUẦN.

export interface StepView {
  label: string;
  /** "26/09" khi đã qua bước; null khi chưa biết ngày. */
  date: string | null;
}

export interface StepperView {
  steps: StepView[];
  /** Bước đang ở (đã huỷ ⇒ bước cuối cùng đã tới). */
  current: number;
  /** Bước cuối đã xong (có hiệu lực / hoàn tất). */
  finished: boolean;
  cancelled: boolean;
}

export interface NextStepView {
  headline: string;
  /** Đến lượt người xem ⇒ nhãn "Việc của bạn" + thanh bước màu vàng. */
  mine: boolean;
  /** Chú thích góc phải khi không phải việc của bạn ("Ký bản giấy", "Từ 20/08/2026"). */
  aux: string | null;
  description: string | null;
}

export type TermNoteTone = "ok" | "muted" | "warn";

export interface TermRow {
  key: string;
  title: string;
  sub?: string | null;
  value?: string | null;
  note?: { text: string; tone: TermNoteTone } | null;
  /** Dòng tuỳ chọn, không tính vào tổng. */
  dim?: boolean;
  /** Dòng tổng (kẻ đậm phía trên). */
  total?: boolean;
}

export interface TermsView {
  /** Nhãn nhỏ đầu bảng: "Chi phí theo báo giá đã chốt" / "Lịch thanh toán" / "Phạm vi dịch vụ". */
  label: string;
  rows: TermRow[];
}

export interface ActivityItem {
  key: string;
  at: string;
  text: string;
  sub?: string | null;
}

export interface SummaryView {
  bigLabel: string;
  bigValue: string;
  /** 0–100 — thanh "đã thu" của hợp đồng mua bán. */
  progress?: number | null;
  progressNote?: string | null;
  rows: { label: string; value: string; tone?: "warn" | "mono" }[];
}

/** "2026-09-26T…" → "26/09". */
export const dayMonth = (iso: string | null | undefined): string | null =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : null;

/** "2026-09-26T…" → "26/09/2026". */
export const fullDay = (iso: string | null | undefined): string | null =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null;

/**
 * Bước hiện tại khi hợp đồng bị huỷ: bước cuối cùng đã có ngày (không có ⇒ bước đầu).
 */
export function cancelledStepIndex(steps: readonly StepView[]): number {
  let idx = 0;
  steps.forEach((s, i) => {
    if (s.date) idx = i;
  });
  return idx;
}

/** Hoạt động mới nhất trước. */
export const newestFirst = (items: ActivityItem[]): ActivityItem[] =>
  [...items].sort((a, b) => b.at.localeCompare(a.at));
