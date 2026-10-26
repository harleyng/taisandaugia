// Sức khoẻ một tài sản trong kế hoạch đấu giá (A5 của docs/owner-auction-planning-plan.md).
//
// ⚠️ CẶP NHÂN BẢN SQL ↔ TS THỨ NĂM của dự án (cùng hạng với targets ↔
// `owner_report_recovery` và `diffBaselines` ↔ `auction_plan_baseline_diff`).
// Bản sao SQL là `public.auction_plan_item_health(...)` (migration
// `20261026130000`). Sửa một bên thì PHẢI sửa bên kia trong cùng lần, và chạy
// lại bảng đối chiếu trong báo cáo pha — không có test nào tự bắt được lệch.
//
// ⚠️ MỌI so sánh ngày ở đây là so CHUỖI `YYYY-MM-DD` chứ không phải `Date`:
// các cột của DB là `DATE` (không có giờ, không có vùng), `asOf` là "hôm nay
// theo giờ Asia/Ho_Chi_Minh". Dựng `new Date(iso)` rồi so là cách chắc nhất để
// một tài sản ở Việt Nam thành "trễ" sớm 7 tiếng. Chuỗi ISO so theo thứ tự từ
// điển = so theo thời gian, nên chuỗi là đủ.
//
// Biên BAO GỒM (A5): tài sản KHÔNG trễ vào đúng ngày cuối tháng kế hoạch, và
// một mốc đến hạn ĐÚNG hôm nay thì chưa quá hạn.

import { vnTodayStr } from "@/lib/legalStatus";
import type {
  AuctionPlanBaseline,
  AuctionPlanItem,
  AuctionPlanItemExecStatus,
} from "./types";

/* ─── Kiểu ────────────────────────────────────────────────────────────────── */

export type PlanItemHealth = "done" | "dropped" | "failed_retry" | "late" | "at_risk" | "on_track";

/** Thứ tự XÉT của A5 — khớp `first match` của bảng, KHÔNG phải thứ tự hiển thị. */
export const PLAN_ITEM_HEALTH_ORDER: readonly PlanItemHealth[] = [
  "done",
  "dropped",
  "failed_retry",
  "late",
  "at_risk",
  "on_track",
] as const;

export const PLAN_ITEM_HEALTH_LABELS: Record<PlanItemHealth, string> = {
  done: "Đã đấu thành",
  dropped: "Đã bỏ khỏi kế hoạch",
  failed_retry: "Không thành · chờ đấu lại",
  late: "Trễ kế hoạch",
  at_risk: "Nguy cơ trễ",
  on_track: "Đúng tiến độ",
};

/** Token màu (A5). `muted` = không có màu trạng thái. */
export const PLAN_ITEM_HEALTH_TONES: Record<PlanItemHealth, "success" | "warning" | "destructive" | "primary" | "muted"> = {
  done: "success",
  dropped: "muted",
  failed_retry: "warning",
  late: "destructive",
  at_risk: "warning",
  on_track: "primary",
};

/** Tài sản — chỉ bốn trường quyết định sức khoẻ. */
export interface PlanItemHealthInput {
  planned_month: string | null;
  forecast_month: string | null;
  exec_status: AuctionPlanItemExecStatus;
  /**
   * Tháng của BẢN MỐC (A5 nói "end of baseline `planned_month`"). Để trống /
   * `undefined` ⇒ dùng `planned_month` hiện tại. Xem `baselineMonthOf`.
   */
  baseline_month?: string | null;
}

/** Mốc công việc — chỉ ba trường quyết định sức khoẻ. */
export interface PlanStepHealthInput {
  sort_order: number;
  planned_date: string | null;
  done_on: string | null;
}

/** Kết quả thực tế của tài sản (một dòng `owner_asset_outcomes` đã chốt). */
export interface PlanOutcomeHealthInput {
  outcome: string | null;
  payment_status: string | null;
}

/* ─── Ngày: chuỗi ISO, không dùng Date để so sánh ─────────────────────────── */

/** "Hôm nay" theo giờ Việt Nam — mặc định của `asOf`. */
export const planHealthToday = (now: Date = new Date()): string => vnTodayStr(now);

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Ngày cuối tháng của "2026-05-01" → "2026-05-31". Sai định dạng ⇒ null. */
export function monthEndIso(month: string | null | undefined): string | null {
  const m = ISO.exec(month ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  // Ngày 0 của tháng sau = ngày cuối tháng này. UTC tường minh ⇒ không lệch vùng.
  const last = new Date(Date.UTC(year, mon, 0));
  return last.toISOString().slice(0, 10);
}

/** Ngày 01 của tháng chứa `iso` ("2026-05-18" → "2026-05-01"). */
export function monthStartIso(iso: string | null | undefined): string | null {
  const m = ISO.exec(iso ?? "");
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/** Cộng `days` ngày vào một chuỗi ISO, trả chuỗi ISO. */
export function addDaysIso(iso: string, days: number): string {
  const m = ISO.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

/* ─── Tháng dùng để so trễ: BẢN MỐC trước, hiện tại sau ───────────────────── */

/**
 * A5 so với `planned_month` của BẢN MỐC. Với kế hoạch đã trình / đã duyệt /
 * đã đóng, trigger của DB khoá trường mốc nên hai giá trị bằng nhau; chỉ ở
 * `adjusting` chúng mới lệch, và lúc đó cam kết còn hiệu lực vẫn là bản mốc —
 * dời tháng trong bản điều chỉnh chưa được duyệt KHÔNG được xoá cái "trễ".
 * Kế hoạch chưa từng duyệt (`baseline_version = 0`) không có bản mốc ⇒ dùng
 * `planned_month` hiện tại, giá trị duy nhất tồn tại.
 */
export const baselineMonthOf = (item: PlanItemHealthInput): string | null =>
  item.baseline_month !== undefined && item.baseline_month !== null
    ? item.baseline_month
    : item.planned_month;

/** `item.id` → `planned_month` trong bản mốc mới nhất. Tài sản thêm sau bản mốc không có khoá. */
export function baselineMonthMap(baseline: AuctionPlanBaseline | null | undefined): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const it of baseline?.payload?.items ?? []) {
    if (it?.id) map.set(it.id, it.planned_month ?? null);
  }
  return map;
}

/** Gắn `baseline_month` cho một tài sản từ bản mốc mới nhất (thiếu ⇒ giữ tháng hiện tại). */
export function withBaselineMonth<T extends AuctionPlanItem>(
  item: T,
  months: Map<string, string | null>,
): T & { baseline_month: string | null } {
  return { ...item, baseline_month: months.has(item.id) ? months.get(item.id)! : item.planned_month };
}

/* ─── Luật A5 ─────────────────────────────────────────────────────────────── */

/** Kết quả coi là "đã đấu thành": bán được VÀ người trúng không bỏ cọc. */
const isSold = (o: PlanOutcomeHealthInput | null | undefined): boolean =>
  !!o && o.outcome === "sold" && o.payment_status !== "defaulted";

/**
 * Kết quả coi là "không thành, chờ đấu lại".
 *
 * A5 kể ba giá trị (unsold / postponed / cancelled); CHECK của
 * `owner_asset_outcomes` còn `withdrawn`, và một phiên bán được nhưng người
 * trúng BỎ CỌC (`payment_status = 'defaulted'`) cũng phải đấu lại — A5 loại nó
 * khỏi `done` bằng chữ "(not defaulted)" nhưng không nói nó rơi vào đâu. Cả hai
 * nằm ở đây, đúng câu nhãn "Không thành · chờ đấu lại".
 */
const isFailed = (o: PlanOutcomeHealthInput | null | undefined): boolean => {
  if (!o || !o.outcome) return false;
  if (o.outcome === "sold") return o.payment_status === "defaulted";
  return o.outcome === "unsold" || o.outcome === "postponed" || o.outcome === "cancelled" || o.outcome === "withdrawn";
};

/** Nhãn tình trạng thu tiền của kết quả phiên (`owner_asset_outcomes.payment_status`). */
export const PLAN_OUTCOME_PAYMENT_LABELS: Record<string, string> = {
  pending: "Chưa thu",
  partial: "Thu một phần",
  paid: "Đã thu đủ",
  defaulted: "Bỏ cọc",
};

/** Số ngày của ngưỡng "sắp đến tháng kế hoạch" (A5). */
export const PLAN_ITEM_AT_RISK_DAYS = 30;

/**
 * Sức khoẻ của một tài sản — luật A5, xét theo THỨ TỰ, lấy cái khớp đầu tiên:
 * `done` → `dropped` → `failed_retry` → `late` → `at_risk` → `on_track`.
 *
 * Thứ tự là phần của luật: tài sản đã bỏ khỏi kế hoạch mà cũng trễ thì đọc là
 * "Đã bỏ khỏi kế hoạch", còn tài sản đã đấu thành thì đọc là "Đã đấu thành"
 * ngay cả khi sau đó bị bỏ khỏi kế hoạch.
 *
 * Tài sản chưa liên kết hồ sơ / tin đăng không có kết quả thực tế (`outcome =
 * null`) — nó không bao giờ là `done` / `failed_retry`, chỉ chạy theo mốc và
 * tháng. UI nói hộ: "Liên kết hồ sơ để tự cập nhật kết quả".
 */
export function planItemHealth(
  item: PlanItemHealthInput,
  steps: readonly PlanStepHealthInput[],
  outcome: PlanOutcomeHealthInput | null | undefined,
  asOf: string = planHealthToday(),
): PlanItemHealth {
  if (isSold(outcome)) return "done";
  if (item.exec_status === "dropped") return "dropped";
  if (isFailed(outcome)) return "failed_retry";

  const month = baselineMonthOf(item);
  const monthEnd = monthEndIso(month);
  // Biên BAO GỒM: đúng ngày cuối tháng kế hoạch vẫn chưa trễ.
  if (monthEnd && asOf > monthEnd) return "late";

  // ① mốc quá hạn mà chưa xong (đến hạn đúng hôm nay là CHƯA quá hạn)
  if (steps.some((s) => s.planned_date && !s.done_on && s.planned_date < asOf)) return "at_risk";
  // ② đã phải dời dự kiến sang tháng muộn hơn tháng của bản mốc
  if (item.forecast_month && month && item.forecast_month > month) return "at_risk";
  // ③ còn ≤ 30 ngày là đến tháng kế hoạch (hoặc đã vào tháng đó) mà mốc đầu tiên chưa xong
  if (month) {
    const first = firstStep(steps);
    if (first && !first.done_on && addDaysIso(asOf, PLAN_ITEM_AT_RISK_DAYS) >= month) return "at_risk";
  }
  return "on_track";
}

/** Mốc ĐẦU TIÊN của bản mẫu (tài sản công không có `legal_ready` nên không cứ là sort_order = 1). */
export function firstStep<T extends { sort_order: number }>(steps: readonly T[]): T | null {
  let best: T | null = null;
  for (const s of steps) if (!best || s.sort_order < best.sort_order) best = s;
  return best;
}

/* ─── Gom nhóm cho chip / bộ lọc ──────────────────────────────────────────── */

export type PlanHealthCounts = Record<PlanItemHealth, number>;

export const emptyPlanHealthCounts = (): PlanHealthCounts => ({
  done: 0,
  dropped: 0,
  failed_retry: 0,
  late: 0,
  at_risk: 0,
  on_track: 0,
});

export function planHealthCounts(values: Iterable<PlanItemHealth>): PlanHealthCounts {
  const counts = emptyPlanHealthCounts();
  for (const v of values) counts[v] += 1;
  return counts;
}
