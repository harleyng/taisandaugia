import { describe, expect, it } from "vitest";
import {
  SALE_REASON_MESSAGES,
  SaleRpcError,
  assertSaleRpcOk,
  cancelConsequenceOf,
  saleErrorMessage,
  saleReasonMessage,
} from "./errors";

/** Mọi mã lý do mà 20260914000001 có thể trả về. */
const SERVER_REASONS = [
  "not_authenticated", "not_found", "not_authorized",
  "not_finalized", "lot_not_sold", "lot_defaulted", "already_exists", "seller_unresolved",
  "invalid_payee", "invalid_status", "invalid_installment", "installments_mismatch",
  "payments_exist", "invalid_path", "file_missing", "invalid_side", "invalid_signed_date",
  "document_changed", "already_confirmed", "invalid_amount", "invalid_method",
  "amount_exceeds_balance", "already_reversed", "invalid_target", "invalid_kind",
  "reason_required", "already_cancelled", "already_completed", "cancelled",
  "invalid_schedule", "sale_contract_exists",
];

describe("SALE_REASON_MESSAGES — phủ hết mã lý do của server", () => {
  it("không mã nào rơi về câu chung chung", () => {
    for (const r of SERVER_REASONS) {
      expect(SALE_REASON_MESSAGES[r], r).toBeTruthy();
      expect(saleReasonMessage(r), r).not.toMatch(/^Thao tác không thành công/);
    }
  });

  it("mọi câu đều là tiếng Việt có dấu và kết thúc bằng dấu câu", () => {
    for (const [k, v] of Object.entries(SALE_REASON_MESSAGES)) {
      expect(v.length, k).toBeGreaterThan(10);
      expect(v.trim().endsWith("."), k).toBe(true);
    }
  });

  it("mã lạ rơi về câu chung", () => {
    expect(saleReasonMessage("khong_biet_ma_nay")).toMatch(/Thao tác không thành công/);
    expect(saleReasonMessage(null)).toMatch(/Thao tác không thành công/);
  });
});

describe("saleReasonMessage — làm giàu câu chữ từ payload", () => {
  it("thu quá tay thì nói rõ còn phải trả bao nhiêu", () => {
    const msg = saleReasonMessage("amount_exceeds_balance", { balance: 3_110_000_000 });
    expect(msg).toContain("3,110,000,000");
  });

  it("số dư dạng chuỗi (JSON numeric của Postgres) vẫn đọc được", () => {
    expect(saleReasonMessage("amount_exceeds_balance", { balance: "3110000000" })).toContain("3,110,000,000");
  });

  it("thiếu payload thì quay về câu mặc định, không vỡ", () => {
    expect(saleReasonMessage("amount_exceeds_balance", {})).toBe(SALE_REASON_MESSAGES.amount_exceeds_balance);
    expect(saleReasonMessage("amount_exceeds_balance", { balance: "x" })).toBe(
      SALE_REASON_MESSAGES.amount_exceeds_balance,
    );
  });

  it("lệch tổng kỳ hạn thì nói rõ con số phải khớp", () => {
    expect(saleReasonMessage("installments_mismatch", { expected: 8_110_000_000 })).toContain("8,110,000,000");
  });
});

describe("assertSaleRpcOk — cổng chống toast xanh giả", () => {
  it("ném khi ok:false", () => {
    expect(() => assertSaleRpcOk({ ok: false, reason: "lot_defaulted" })).toThrow(SaleRpcError);
  });

  it("giữ nguyên reason và payload để UI dùng tiếp", () => {
    try {
      assertSaleRpcOk({ ok: false, reason: "amount_exceeds_balance", balance: 500 });
      throw new Error("đáng lẽ phải ném");
    } catch (e) {
      expect(e).toBeInstanceOf(SaleRpcError);
      expect((e as SaleRpcError).reason).toBe("amount_exceeds_balance");
      expect((e as SaleRpcError).details.balance).toBe(500);
      expect((e as SaleRpcError).message).toContain("500");
    }
  });

  it("im lặng với ok:true và mọi dữ liệu khác", () => {
    const harmless: unknown[] = [{ ok: true }, null, undefined, [], "x", 1, { reason: "x" }];
    for (const v of harmless) {
      expect(() => assertSaleRpcOk(v)).not.toThrow();
    }
  });
});

describe("saleErrorMessage — lớp lỗi Postgres / mạng", () => {
  it("ưu tiên câu của SaleRpcError", () => {
    expect(saleErrorMessage(new SaleRpcError("lot_defaulted"))).toBe(SALE_REASON_MESSAGES.lot_defaulted);
  });

  it("mất mạng", () => {
    expect(saleErrorMessage(new Error("Failed to fetch"))).toMatch(/Mất kết nối/);
  });

  it("thiếu quyền", () => {
    expect(saleErrorMessage(new Error('permission denied ... 42501'))).toMatch(/không có quyền/);
  });

  it("lỗi không rõ vẫn ra câu dùng được", () => {
    expect(saleErrorMessage({})).toMatch(/Thao tác không thành công/);
  });
});

describe("cancelConsequenceOf — hậu quả tiền đặt trước phải nói TRƯỚC khi bấm", () => {
  it("bên mua từ chối ⇒ MẤT cọc", () => {
    expect(cancelConsequenceOf("buyer_refused")).toMatch(/MẤT/);
  });

  it("hai loại còn lại ⇒ chờ hoàn trả", () => {
    expect(cancelConsequenceOf("seller_refused")).toMatch(/chờ hoàn trả/);
    expect(cancelConsequenceOf("mutual")).toMatch(/chờ hoàn trả/);
  });
});
