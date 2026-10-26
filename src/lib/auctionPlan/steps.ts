// Mốc công việc của một tài sản trong kế hoạch (A4.4) — luật thuần dùng cho
// tab "Tiến độ", lưới 12 tháng và ngăn chi tiết.
//
// Nhãn NGUỒN dùng đúng bộ từ của Trạm Điều Hành (§A3 / A8.5 của
// docs/owner-control-tower-plan.md): "Sàn xác nhận" cho dữ liệu sàn tự thấy,
// "Có tài liệu" cho mốc đơn vị tự khai kèm tệp, "Tự khai" cho mốc khai tay
// không tệp. `source` KHÔNG phải cột client ghi được — "Sàn xác nhận" là lời
// của sàn, không phải lời người dùng.

import { PenLine, ShieldCheck, Paperclip, type LucideIcon } from "lucide-react";
import { AUCTION_PLAN_STEP_LABELS, type AuctionPlanItemStep, type AuctionPlanStep } from "./types";

export type PlanStepSourceKind = "platform" | "documented" | "self";

export interface PlanStepSourceMeta {
  kind: PlanStepSourceKind;
  label: string;
  icon: LucideIcon;
  tone: "success" | "primary" | "muted";
  hint: string;
}

export const PLAN_STEP_SOURCE_META: Record<PlanStepSourceKind, PlanStepSourceMeta> = {
  platform: {
    kind: "platform",
    label: "Sàn xác nhận",
    icon: ShieldCheck,
    tone: "success",
    hint: "Mốc này do dữ liệu trên sàn xác nhận (hồ sơ, hợp đồng, phiên, kết quả) — không phải đơn vị tự khai.",
  },
  documented: {
    kind: "documented",
    label: "Có tài liệu",
    icon: Paperclip,
    tone: "primary",
    hint: "Đơn vị tự khai hoàn thành và có đính kèm văn bản.",
  },
  self: {
    kind: "self",
    label: "Tự khai",
    icon: PenLine,
    tone: "muted",
    hint: "Đơn vị tự khai hoàn thành, chưa đính kèm văn bản.",
  },
};

/** Nguồn hiển thị của MỘT mốc đã xong. Mốc chưa xong không có nhãn nguồn. */
export function planStepSource(step: PlanStepLike): PlanStepSourceMeta | null {
  if (!step.done_on) return null;
  if (step.source === "platform") return PLAN_STEP_SOURCE_META.platform;
  const hasFile = (step.evidence_urls?.length ?? 0) > 0 || !!step.doc_no;
  return hasFile ? PLAN_STEP_SOURCE_META.documented : PLAN_STEP_SOURCE_META.self;
}

export type PlanStepLike = Pick<
  AuctionPlanItemStep,
  "step" | "sort_order" | "planned_date" | "done_on" | "doc_no" | "evidence_urls" | "source"
>;

export const planStepLabel = (step: AuctionPlanStep): string => AUCTION_PLAN_STEP_LABELS[step] ?? step;

/** Mốc theo đúng thứ tự bản mẫu. */
export const sortPlanSteps = <T extends { sort_order: number }>(steps: readonly T[]): T[] =>
  [...steps].sort((a, b) => a.sort_order - b.sort_order);

export interface PlanStepProgress {
  done: number;
  total: number;
  /** Mốc tiếp theo chưa xong (theo thứ tự bản mẫu); null = đã xong hết. */
  next: PlanStepLike | null;
  /** Mốc có ngày dự kiến đã qua mà chưa xong, sớm nhất trước. */
  overdue: PlanStepLike[];
}

/** `asOf` là chuỗi `YYYY-MM-DD` giờ Việt Nam — so chuỗi, không dựng Date (xem health.ts). */
export function planStepProgress(steps: readonly PlanStepLike[], asOf: string): PlanStepProgress {
  const ordered = sortPlanSteps(steps);
  const done = ordered.filter((s) => !!s.done_on).length;
  const next = ordered.find((s) => !s.done_on) ?? null;
  const overdue = ordered
    .filter((s) => s.planned_date && !s.done_on && s.planned_date < asOf)
    .sort((a, b) => (a.planned_date! < b.planned_date! ? -1 : 1));
  return { done, total: ordered.length, next, overdue };
}

/** Gom mốc theo tài sản — một lần duy nhất cho cả lưới và ngăn chi tiết. */
export function groupStepsByItem<T extends { item_id: string }>(steps: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const s of steps) {
    const list = map.get(s.item_id);
    if (list) list.push(s);
    else map.set(s.item_id, [s]);
  }
  return map;
}

/* ─── Mốc do sàn suy ra (A4.4) ────────────────────────────────────────────── */

/** Các mốc mà `auction_plan_platform_steps` có thể tự xác nhận. */
export const PLAN_PLATFORM_STEPS: readonly AuctionPlanStep[] = [
  "org_selected",
  "contract_signed",
  "announced",
  "auction_held",
  "paid",
] as const;

export const PLAN_PLATFORM_STEP_SOURCES: Record<string, string> = {
  org_selected: "Hồ sơ số hoá đã chốt tổ chức đấu giá",
  contract_signed: "Hợp đồng dịch vụ đấu giá đã ký",
  announced: "Lô đã nằm trong phiên đã công bố",
  auction_held: "Đã có kết quả phiên",
  paid: "Kết quả phiên ghi đã thu đủ tiền",
};

export const isPlatformStep = (step: AuctionPlanStep): boolean => PLAN_PLATFORM_STEPS.includes(step);
