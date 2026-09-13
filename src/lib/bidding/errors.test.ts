import { describe, expect, it } from "vitest";
import {
  assertBiddingRpcOk,
  BiddingRpcError,
  biddingErrorMessage,
  biddingReasonMessage,
} from "./errors";

describe("assertBiddingRpcOk", () => {
  it("im lặng với {ok:true} và mọi dữ liệu khác", () => {
    expect(() => assertBiddingRpcOk({ ok: true, bid_id: "b1" })).not.toThrow();
    expect(() => assertBiddingRpcOk(null)).not.toThrow();
    expect(() => assertBiddingRpcOk([{ ok: false }])).not.toThrow();
  });

  it("{ok:false} ⇒ ném BiddingRpcError mang reason + toàn bộ payload", () => {
    try {
      assertBiddingRpcOk({ ok: false, reason: "lot_paused" });
      expect.unreachable("phải ném lỗi");
    } catch (err) {
      expect(err).toBeInstanceOf(BiddingRpcError);
      expect((err as BiddingRpcError).reason).toBe("lot_paused");
      expect((err as BiddingRpcError).message).toBe(
        "Lô đang tạm dừng. Vui lòng chờ đấu giá viên tiếp tục.",
      );
    }
  });

  it("reason lạ ⇒ câu fallback, không lộ mã kỹ thuật", () => {
    const err = new BiddingRpcError("khong_co_trong_tu_dien");
    expect(err.message).toBe("Thao tác không thành công. Vui lòng thử lại.");
  });
});

describe("biddingReasonMessage", () => {
  it("ghép số tiền cụ thể khi server trả min_amount / max_amount", () => {
    expect(biddingReasonMessage("bid_too_low", { min_amount: 6_450_000_000 })).toBe(
      "Giá trả tối thiểu cho lượt này là 6,450,000,000₫.",
    );
    expect(biddingReasonMessage("bid_too_many_steps", { max_amount: 6_850_000_000 })).toBe(
      "Giá trả tối đa cho một lượt là 6,850,000,000₫.",
    );
  });

  it("thiếu số tiền thì lùi về câu chung", () => {
    expect(biddingReasonMessage("bid_too_low")).toBe(
      "Giá trả phải cao hơn giá hiện tại ít nhất một bước giá.",
    );
  });

  it("phủ các mã của luồng điều hành", () => {
    expect(biddingReasonMessage("lots_not_closed")).toMatch(/đóng hết các lô/i);
    expect(biddingReasonMessage("already_finalized")).toMatch(/đã được chốt/i);
    expect(biddingReasonMessage("not_authorized")).toMatch(/không có quyền/i);
  });
});

describe("biddingErrorMessage", () => {
  it("giữ nguyên thông điệp đã dịch của BiddingRpcError", () => {
    expect(biddingErrorMessage(new BiddingRpcError("lot_closed"))).toBe(
      "Lô đã đóng, không nhận thêm lượt trả giá.",
    );
  });

  it("dịch lỗi hệ thống: bảng không có policy ghi ⇒ 42501", () => {
    expect(biddingErrorMessage({ code: "42501", message: "permission denied for table auction_bids" })).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
    expect(biddingErrorMessage({ message: "new row violates row-level security policy" })).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
  });

  it("mất mạng và check constraint có câu riêng", () => {
    expect(biddingErrorMessage({ message: "Failed to fetch" })).toBe("Mất kết nối. Vui lòng thử lại.");
    expect(biddingErrorMessage({ message: 'new row violates check constraint "als_live_shape"' })).toMatch(
      /kiểm tra lại số tiền/i,
    );
  });

  it("không có gì để nói ⇒ câu mặc định", () => {
    expect(biddingErrorMessage({})).toBe("Thao tác không thành công. Vui lòng thử lại.");
  });
});
