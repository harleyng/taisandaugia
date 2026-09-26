// Khoản thu chi của một kết quả phiên — Phase 15a (docs/owner-control-tower-plan.md).
//
// Sổ thật là bảng owner_cash_events; paid_amount / paid_at / auction_fee /
// payment_status trên owner_asset_outcomes là TỔNG do trigger dựng lại, client
// không được ghi (trigger báo lỗi). Module này thuần để test được.

import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const CASH_KINDS = ["deposit", "payment", "fee", "refund"] as const;
export type CashKind = (typeof CASH_KINDS)[number];

export const CASH_KIND_LABEL: Record<CashKind, string> = {
  deposit: "Tiền đặt trước",
  payment: "Tiền thanh toán",
  fee: "Phí & chi phí",
  refund: "Hoàn trả",
};

export const CASH_KIND_HINT: Record<CashKind, string> = {
  deposit: "Tiền đặt trước chuyển về đơn vị — kể cả khi người trúng bỏ cọc",
  payment: "Người trúng nộp tiền mua tài sản",
  fee: "Thù lao tổ chức đấu giá và chi phí đơn vị đã trả",
  refund: "Tiền đơn vị trả lại cho người mua",
};

/** Tiền về (+) hay tiền ra (−) của đơn vị. */
export const CASH_KIND_SIGN: Record<CashKind, 1 | -1> = { deposit: 1, payment: 1, fee: -1, refund: -1 };

/** Khoản có tính vào "số đã thu" của tài sản không (phí thì không). */
export const countsTowardCollected = (kind: CashKind) => kind !== "fee";

export function isCashKind(v: unknown): v is CashKind {
  return typeof v === "string" && (CASH_KINDS as readonly string[]).includes(v);
}

/** Số tiền có dấu theo loại khoản. */
export const signedAmount = (kind: CashKind, amount: number) => CASH_KIND_SIGN[kind] * amount;

// ─── Biểu mẫu ────────────────────────────────────────────────────────────────

/** Bối cảnh của kết quả phiên mà khoản gắn vào — để kiểm số. */
export interface CashEventContext {
  /** Kết quả phiên hiện tại của bản ghi. */
  sold: boolean;
  defaulted: boolean;
  winningPrice: number | null;
  /** Số đã thu hiện có của bản ghi (paid_amount tính sẵn). */
  collected: number;
  /** Ngày tối đa được chọn (hôm nay theo server). */
  maxDay: string;
  /** Đang sửa khoản cũ: bỏ phần của khoản đó khỏi "đã thu" trước khi kiểm. */
  editing?: { kind: CashKind; amount: number } | null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function makeCashEventSchema(ctx: CashEventContext) {
  const before =
    ctx.editing && countsTowardCollected(ctx.editing.kind)
      ? ctx.collected - signedAmount(ctx.editing.kind, ctx.editing.amount)
      : ctx.collected;
  return z
    .object({
      kind: z.enum(CASH_KINDS, { errorMap: () => ({ message: "Chọn loại khoản" }) }),
      amount: z.string().regex(/^\d+$/, "Nhập số tiền"),
      occurredOn: z.string().regex(ISO_DAY, "Chọn ngày"),
      note: z.string().max(500, "Ghi chú tối đa 500 ký tự").optional(),
    })
    .superRefine((v, c) => {
      const amount = Number(v.amount);
      if (v.amount && amount <= 0) c.addIssue({ code: "custom", path: ["amount"], message: "Số tiền phải lớn hơn 0" });
      if (v.occurredOn > ctx.maxDay) {
        c.addIssue({ code: "custom", path: ["occurredOn"], message: "Ngày ghi nhận không được sau hôm nay" });
      }
      if (v.kind === "payment") {
        if (!ctx.sold) {
          c.addIssue({ code: "custom", path: ["kind"], message: "Tiền thanh toán chỉ ghi cho phiên đấu thành" });
        } else if (ctx.defaulted) {
          c.addIssue({ code: "custom", path: ["kind"], message: "Người trúng đã bỏ cọc — không ghi tiền thanh toán" });
        } else if (ctx.winningPrice && amount > 0 && before + amount > ctx.winningPrice) {
          const left = Math.max(0, ctx.winningPrice - before);
          c.addIssue({
            code: "custom",
            path: ["amount"],
            message: left > 0 ? `Vượt số còn phải thu (${left.toLocaleString("en-US")} ₫)` : "Tài sản đã thu đủ",
          });
        }
      }
      if (v.kind === "refund" && amount > 0 && amount > before) {
        c.addIssue({ code: "custom", path: ["amount"], message: "Hoàn trả không được lớn hơn số đã thu" });
      }
    });
}

export type CashEventForm = z.infer<ReturnType<typeof makeCashEventSchema>>;

type CashEventInsert = Database["public"]["Tables"]["owner_cash_events"]["Insert"];
type CashEventUpdate = Database["public"]["Tables"]["owner_cash_events"]["Update"];

/** ĐÚNG các cột client được GRANT INSERT — thêm cột khác là lỗi quyền. */
export type CashEventInsertPayload = Pick<CashEventInsert, "outcome_id" | "kind" | "amount" | "occurred_on" | "note">;
/** ĐÚNG các cột client được GRANT UPDATE. */
export type CashEventUpdatePayload = Pick<CashEventUpdate, "kind" | "amount" | "occurred_on" | "note">;

const noteOf = (note: string | undefined) => {
  const t = (note ?? "").trim();
  return t ? t : null;
};

export function toCashEventInsert(outcomeId: string, form: CashEventForm): CashEventInsertPayload {
  return {
    outcome_id: outcomeId,
    kind: form.kind,
    amount: Number(form.amount),
    occurred_on: form.occurredOn,
    note: noteOf(form.note),
  };
}

export function toCashEventUpdate(form: CashEventForm): CashEventUpdatePayload {
  return { kind: form.kind, amount: Number(form.amount), occurred_on: form.occurredOn, note: noteOf(form.note) };
}

// ─── Lỗi ─────────────────────────────────────────────────────────────────────

export function cashEventErrorMessage(err: unknown): string {
  const e = (err && typeof err === "object" ? err : {}) as { code?: string; message?: string };
  if (e.code === "42501") return "Bạn không có quyền ghi thu chi cho tài sản này.";
  if (e.code === "P0001" && e.message) return e.message;
  if (e.code === "23514") return "Số tiền không hợp lệ.";
  return "Không lưu được khoản thu chi. Vui lòng thử lại.";
}

export const SETTLE_REASONS = ["not_authenticated", "not_found", "not_sold", "defaulted", "already_paid"] as const;
export type SettleReason = (typeof SETTLE_REASONS)[number];

export const SETTLE_REASON_MESSAGE: Record<SettleReason, string> = {
  not_authenticated: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  not_found: "Bạn không có quyền ghi thu tiền cho tài sản này.",
  not_sold: "Tài sản này không đấu thành — không có tiền phải thu.",
  defaulted: "Người trúng đã bỏ cọc — không còn tiền phải thu.",
  already_paid: "Tài sản này đã thu đủ.",
};

export function settleReasonMessage(reason: unknown): string {
  return typeof reason === "string" && (SETTLE_REASONS as readonly string[]).includes(reason)
    ? SETTLE_REASON_MESSAGE[reason as SettleReason]
    : "Không ghi nhận được. Vui lòng thử lại.";
}
