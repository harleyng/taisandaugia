// Thu tiền sau phiên thành — thao tác nhanh ở "Nhịp đập" (docs/owner-control-tower-plan.md Phase 7).
//
// Từ Phase 15a số đã thu KHÔNG còn ghi thẳng vào owner_asset_outcomes: mỗi lần thu là
// một khoản trong sổ owner_cash_events (xem ownerCashEvent.ts), trigger dựng lại
// paid_amount / payment_status. Ở đây chỉ còn cờ "Người trúng bỏ cọc" (ghi tay) và
// biểu mẫu "Thu một phần". Thuần để test được.

import { z } from "zod";
import type { CashEventInsertPayload } from "@/lib/ownerCashEvent";

/** Chỉ còn trạng thái — cờ "bỏ cọc" là ghi tay; ghi giá trị khác ⇒ server tính lại từ sổ. */
export interface OutcomePaymentStatusPatch {
  payment_status: "defaulted" | "pending";
}

/** "Người trúng bỏ cọc": giữ nguyên các khoản đã thu làm lịch sử. */
export const DEFAULTED_PATCH: OutcomePaymentStatusPatch = { payment_status: "defaulted" };

/** Số còn phải thu (không âm); thiếu giá trúng ⇒ null. */
export function remainingOf(winning: number | null, paid: number | null): number | null {
  if (!winning || winning <= 0) return null;
  return Math.max(0, winning - (paid && paid > 0 ? paid : 0));
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "Thu một phần": số thu LẦN NÀY — không vượt số còn phải thu (bằng ⇒ coi như thu đủ). */
export function makePartialPaymentSchema(remaining: number | null, today: string) {
  return z
    .object({
      amount: z.string().regex(/^\d+$/, "Nhập số tiền thu lần này"),
      paidAt: z.string().regex(ISO_DAY, "Chọn ngày thu"),
    })
    .superRefine((v, ctx) => {
      const amount = Number(v.amount);
      if (v.amount && amount <= 0) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Số tiền phải lớn hơn 0" });
      }
      if (remaining !== null && amount > remaining) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message:
            remaining > 0
              ? `Vượt số còn phải thu (${remaining.toLocaleString("en-US")} ₫)`
              : "Tài sản đã thu đủ",
        });
      }
      if (v.paidAt > today) {
        ctx.addIssue({ code: "custom", path: ["paidAt"], message: "Ngày thu không được sau hôm nay" });
      }
    });
}

export type PartialPaymentForm = z.infer<ReturnType<typeof makePartialPaymentSchema>>;

/** Khoản "tiền thanh toán" của lần thu này — đúng các cột được GRANT INSERT. */
export function partialPaymentEvent(outcomeId: string, form: PartialPaymentForm): CashEventInsertPayload {
  return { outcome_id: outcomeId, kind: "payment", amount: Number(form.amount), occurred_on: form.paidAt, note: null };
}

/** Phần trăm đã thu (làm tròn xuống, 0–100); thiếu số ⇒ null. */
export function paidPercent(paid: number | null, winning: number | null): number | null {
  if (!paid || !winning || winning <= 0) return null;
  return Math.min(100, Math.floor((paid / winning) * 100));
}

export function paymentErrorMessage(err: unknown): string {
  const e = (err && typeof err === "object" ? err : {}) as { code?: string; message?: string };
  if (e.code === "42501") return "Bạn không có quyền cập nhật thu tiền cho tài sản này.";
  if (e.code === "P0001" && e.message) return e.message;
  return "Không cập nhật được thu tiền. Vui lòng thử lại.";
}
