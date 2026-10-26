// Bản in theo mẫu chính thức của một kế hoạch đấu giá (§A9).
//
// Phần thuần: chọn NGUỒN SỐ LIỆU và dựng dòng cho bảng bảy cột. Hai luật đáng
// nhớ:
//   1. Kế hoạch ĐÃ DUYỆT in theo BẢN MỐC mới nhất (`payload.items` +
//      `payload.totals`) — đó là bản đã ký, không phải danh mục có thể đã sửa.
//      Mọi trạng thái khác in danh mục hiện tại và đóng dấu "BẢN DỰ THẢO".
//   2. Tài sản `exec_status = 'dropped'` không in (payload bản mốc cũng không có
//      chúng — `auction_plan_baseline_payload` lọc `active`).

import { planItemTotals, type PlanTotals } from "./totals";
import type {
  AuctionPlan,
  AuctionPlanBaseline,
  AuctionPlanBaselinePayload,
  AuctionPlanItem,
} from "./types";

/** Bảy cột của biểu mẫu chính thức, đúng thứ tự §A9. */
export const PLAN_PRINT_COLUMNS = [
  "STT",
  "Tên lô đất",
  "Số lô",
  "Diện tích (m²)",
  "Đặc điểm, vị trí",
  "Giá khởi điểm dự kiến (đồng/m²)",
  "Thời gian dự kiến",
] as const;

type PrintItem = AuctionPlanBaselinePayload["items"][number];

export interface PlanPrintRow {
  key: string;
  seq: number;
  itemCode: string;
  assetType: string | null;
  title: string;
  lotLabels: string;
  area: number | null;
  location: string;
  unitPrice: number | null;
  /** "Tháng 6/2027" — biểu mẫu giấy ghi theo tháng. */
  period: string;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "2027-06-01" → "Tháng 6/2027"; chưa chọn ⇒ gạch ngang. */
export function printPeriodLabel(planned: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(planned ?? "");
  return m ? `Tháng ${Number(m[2])}/${m[1]}` : "—";
}

/** "2026-10-26" / ISO đầy đủ → "26/10/2026". */
export function formatPlanDate(value: string | null | undefined): string {
  if (!value) return "—";
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.split("-").reverse().join("/") : value;
}

/** "26/10/2026" → "ngày 26 tháng 10 năm 2026" (dòng ngày tháng của văn bản). */
export function formalDateLine(value: string | null | undefined): string {
  const day = (value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const [y, m, d] = day.split("-");
  return `ngày ${Number(d)} tháng ${Number(m)} năm ${y}`;
}

export function planPrintRows(items: readonly PrintItem[]): PlanPrintRow[] {
  return items.map((item, index) => ({
    key: item.id || item.item_code || String(index),
    seq: index + 1,
    itemCode: item.item_code,
    assetType: item.asset_type ?? null,
    title: item.title,
    lotLabels: item.lot_labels?.trim() || "—",
    area: num(item.area_m2),
    location: item.location?.trim() || "—",
    unitPrice: num(item.unit_start_price),
    period: printPeriodLabel(item.planned_month),
  }));
}

export interface PlanPrintSource {
  rows: PlanPrintRow[];
  totals: PlanTotals;
  /** Bản mốc được in; null = in danh mục hiện tại. */
  baseline: AuctionPlanBaseline | null;
  /** true ⇒ đóng dấu "BẢN DỰ THẢO" trên đầu trang in. */
  isDraft: boolean;
}

/**
 * Chọn nguồn in: bản mốc mới nhất khi kế hoạch đã duyệt (hoặc đã đóng), ngược
 * lại là danh mục hiện tại.
 *
 * `baselines` nhận theo thứ tự nào cũng được — hàm tự lấy `version` lớn nhất.
 */
export function planPrintSource(
  plan: AuctionPlan,
  items: readonly AuctionPlanItem[],
  baselines: readonly AuctionPlanBaseline[],
): PlanPrintSource {
  const latest = baselines.reduce<AuctionPlanBaseline | null>(
    (best, b) => (best === null || b.version > best.version ? b : best),
    null,
  );
  const useBaseline = (plan.status === "approved" || plan.status === "closed") && !!latest;

  if (useBaseline && latest) {
    const baseItems = Array.isArray(latest.payload?.items) ? latest.payload.items : [];
    return {
      rows: planPrintRows(baseItems),
      totals: planItemTotals(
        baseItems.map((i) => ({
          planned_month: i.planned_month,
          area_m2: i.area_m2,
          expected_start_value: i.expected_start_value,
          exec_status: "active" as const,
        })),
      ),
      baseline: latest,
      isDraft: false,
    };
  }

  const active = items.filter((i) => i.exec_status !== "dropped");
  return { rows: planPrintRows(active), totals: planItemTotals(items), baseline: null, isDraft: true };
}

/** Tiêu đề bản in: "DANH MỤC TÀI SẢN ĐẤU GIÁ QUYỀN SỬ DỤNG ĐẤT NĂM 2027". */
export function planPrintTitle(plan: AuctionPlan, rows: readonly Pick<PlanPrintRow, "assetType">[]): string {
  const onlyPublic = rows.length > 0 && rows.every((r) => r.assetType === "public_asset");
  const what = onlyPublic ? "TÀI SẢN CÔNG" : "TÀI SẢN ĐẤU GIÁ QUYỀN SỬ DỤNG ĐẤT";
  const kind = plan.kind === "supplement" ? " (BỔ SUNG)" : "";
  return `DANH MỤC ${what} NĂM ${plan.plan_year}${kind}`;
}
