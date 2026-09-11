// Phương án tổ chức đấu giá & chi phí theo khoản mục — logic dùng chung cho
// CẢ HAI phía: form nhập của tổ chức (/portal/yeu-cau-ky-gui) và màn đọc/so
// sánh của chủ tài sản (QuoteComparison).
//
// Một nguồn duy nhất là cố ý: hai bên phải nhìn thấy đúng cùng một con số, nếu
// không chủ tài sản sẽ chọn theo tổng này rồi ký hợp đồng theo tổng kia.

import { z } from "zod";
import {
  CHANNEL_LABEL,
  DEPOSIT_LEGAL_RANGE,
  FINAL_MILESTONE_KEY,
  MILESTONE_LABEL,
  QUOTE_MILESTONES,
  SCOPE_LABEL,
} from "@/constants/quote-plan";
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from "@/types/asset-posting";
import type { QuoteFeeItem, QuotePlan } from "@/types/consignment";
import { formatVnd } from "@/lib/advertising/slug";

/** Tổng MỌI khoản phí, gồm cả khoản tuỳ chọn — chỉ để hiển thị "tối đa". */
export function feeTotal(items: QuoteFeeItem[] | null | undefined): number {
  return (items ?? []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

/**
 * Tổng các khoản BẮT BUỘC — đây mới là `quote_service_fee` và là con số đi vào
 * `opportunities.gross_amount`.
 *
 * NHÂN BẢN CÓ CHỦ Ý: cùng công thức nằm trong SQL ở
 * supabase/migrations/20260911000002_quote_plan_fee_items.sql (nhánh 'quote' của
 * org_respond_service_request). Sửa một bên phải sửa bên kia — server là bên
 * quyết định, hàm này chỉ để hiện tổng ngay khi đang gõ.
 */
export function feeTotalRequired(items: QuoteFeeItem[] | null | undefined): number {
  return (items ?? [])
    .filter((i) => !i.optional)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

/** Mốc "mở phiên" — chính là quote_lead_time_days. */
export function planLeadTimeDays(plan: QuotePlan | null | undefined): number | null {
  const v = plan?.milestones?.[FINAL_MILESTONE_KEY];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Tiền đặt trước quy về VNĐ, để so sánh được giữa hai chế độ nhập. */
export function depositAmount(
  plan: QuotePlan | null | undefined,
  startingPrice: number | null | undefined,
): number | null {
  if (!plan || plan.deposit_value == null) return null;
  if (plan.deposit_mode === "amount") return plan.deposit_value;
  if (startingPrice == null) return null;
  return Math.round((startingPrice * plan.deposit_value) / 100);
}

/** Tiền đặt trước tính theo % giá khởi điểm — dùng để đối chiếu khung 5–20%. */
export function depositPercent(
  plan: QuotePlan | null | undefined,
  startingPrice: number | null | undefined,
): number | null {
  if (!plan || plan.deposit_value == null) return null;
  if (plan.deposit_mode === "percent") return plan.deposit_value;
  if (!startingPrice) return null;
  return (plan.deposit_value / startingPrice) * 100;
}

/**
 * Ngoài khung 5–20% giá khởi điểm của Luật Đấu giá tài sản.
 * Chỉ để CẢNH BÁO — vẫn có trường hợp đặc thù nên không chặn.
 */
export function depositOutOfLegalRange(
  plan: QuotePlan | null | undefined,
  startingPrice: number | null | undefined,
): boolean {
  const pct = depositPercent(plan, startingPrice);
  if (pct == null) return false;
  return pct < DEPOSIT_LEGAL_RANGE.min || pct > DEPOSIT_LEGAL_RANGE.max;
}

/** Mốc thời gian phải tăng dần: niêm yết không thể trước thẩm định. */
export function milestonesOutOfOrder(plan: QuotePlan | null | undefined): boolean {
  const days = QUOTE_MILESTONES.map((m) => plan?.milestones?.[m.key]).filter(
    (d): d is number => typeof d === "number",
  );
  return days.some((d, i) => i > 0 && d < days[i - 1]);
}

export interface PlanRow {
  label: string;
  value: string;
}

/**
 * Phương án dưới dạng các dòng nhãn–giá trị. Một nguồn duy nhất cho cả sheet
 * của tổ chức lẫn card của chủ tài sản, để hai bên đọc cùng một thứ tự.
 */
export function planSummary(
  plan: QuotePlan | null | undefined,
  startingPrice?: number | null,
): PlanRow[] {
  if (!plan) return [];
  const rows: PlanRow[] = [];

  if (plan.auction_format) {
    rows.push({
      label: "Hình thức đề xuất",
      value: AUCTION_FORMAT_LABELS[plan.auction_format as AuctionFormat] ?? plan.auction_format,
    });
  }
  if (plan.price_step != null) {
    rows.push({ label: "Bước giá", value: formatVnd(plan.price_step) });
  }

  const deposit = depositAmount(plan, startingPrice);
  if (plan.deposit_value != null) {
    rows.push({
      label: "Tiền đặt trước",
      value:
        plan.deposit_mode === "percent"
          ? `${plan.deposit_value}%${deposit != null ? ` · ${formatVnd(deposit)}` : ""}`
          : formatVnd(plan.deposit_value),
    });
  }
  if (plan.venue) rows.push({ label: "Địa điểm tổ chức", value: plan.venue });

  const channels = [
    ...(plan.channels ?? []).map((c) => CHANNEL_LABEL[c] ?? c),
    ...(plan.channels_other ? [plan.channels_other] : []),
  ];
  if (channels.length) rows.push({ label: "Kênh niêm yết", value: channels.join(" · ") });

  for (const m of QUOTE_MILESTONES) {
    const d = plan.milestones?.[m.key];
    if (typeof d === "number") {
      rows.push({ label: MILESTONE_LABEL[m.key] ?? m.label, value: `${d} ngày` });
    }
  }

  if (plan.scope_included?.length) {
    rows.push({
      label: "Bao gồm",
      value: plan.scope_included.map((s) => SCOPE_LABEL[s] ?? s).join(" · "),
    });
  }
  if (plan.scope_excluded?.length) {
    rows.push({
      label: "Không bao gồm",
      value: plan.scope_excluded.map((s) => SCOPE_LABEL[s] ?? s).join(" · "),
    });
  }

  return rows;
}

/** Phương án rỗng — điểm khởi đầu của form. */
export function emptyQuotePlan(auctionFormat: AuctionFormat | null = null): QuotePlan {
  return {
    auction_format: auctionFormat,
    price_step: null,
    deposit_mode: "percent",
    deposit_value: null,
    venue: null,
    channels: [],
    channels_other: null,
    milestones: {},
    scope_included: [],
    scope_excluded: [],
  };
}

// ─── Validate trước khi gửi ──────────────────────────────────────────────────
// DB chỉ từ chối SAI KIỂU (jsonb_typeof); ràng buộc nội dung nằm ở đây.

export const quoteFeeItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().trim().min(1, "Khoản mục phải có tên"),
  amount: z.number().nonnegative("Số tiền không được âm"),
  optional: z.boolean(),
});

export const quotePlanSchema = z.object({
  auction_format: z.enum(["truc_tiep", "truc_tuyen", "ca_hai"], {
    errorMap: () => ({ message: "Chọn hình thức đấu giá đề xuất" }),
  }),
  price_step: z.number().nonnegative().nullable(),
  deposit_mode: z.enum(["percent", "amount"]),
  deposit_value: z.number().nonnegative().nullable(),
  venue: z.string().nullable(),
  channels: z.array(z.string()),
  channels_other: z.string().nullable(),
  milestones: z.record(z.number().int().positive()),
  scope_included: z.array(z.string()),
  scope_excluded: z.array(z.string()),
});

export interface QuoteValidationResult {
  ok: boolean;
  /** Lỗi theo tab để chấm badge đúng chỗ. */
  errors: { plan: string[]; fee: string[] };
}

/** Kiểm toàn bộ báo giá trước khi gửi; gom lỗi theo tab của dialog. */
export function validateQuote(
  plan: QuotePlan,
  feeItems: QuoteFeeItem[],
  commissionPct: number | null,
): QuoteValidationResult {
  const planErrors: string[] = [];
  const feeErrors: string[] = [];

  if (!plan.auction_format) planErrors.push("Chọn hình thức đấu giá đề xuất");
  if (planLeadTimeDays(plan) == null) planErrors.push("Nhập số ngày tới khi mở phiên");
  if (milestonesOutOfOrder(plan)) planErrors.push("Các mốc thời gian phải tăng dần");

  for (const item of feeItems) {
    if (!item.label.trim()) feeErrors.push("Mỗi khoản chi phí phải có tên");
    if (!(Number(item.amount) >= 0)) feeErrors.push("Số tiền không hợp lệ");
  }
  if (commissionPct != null && (commissionPct < 0 || commissionPct > 100)) {
    feeErrors.push("Thù lao phải trong khoảng 0–100%");
  }
  if (commissionPct == null && feeItems.length === 0) {
    feeErrors.push("Báo giá phải có thù lao hoặc ít nhất một khoản chi phí");
  }

  return {
    ok: planErrors.length === 0 && feeErrors.length === 0,
    errors: { plan: [...new Set(planErrors)], fee: [...new Set(feeErrors)] },
  };
}
