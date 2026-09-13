import { describe, expect, it } from "vitest";
import { actorLabelOf, describeLotEvent, SYSTEM_ACTOR_LABEL } from "./lotEventText";
import type { LotEvent, LotEventKind } from "@/types/auction-bidding";

const LOTS = new Map([["lot-1", 1], ["lot-2", 2]]);

const ev = (kind: LotEventKind, payload: Record<string, unknown> = {}, lotId: string | null = "lot-2"): LotEvent =>
  ({
    id: "e1",
    session_id: "s1",
    lot_id: lotId,
    kind,
    actor_id: null,
    payload,
    at: "2026-10-01T10:00:00Z",
  }) as unknown as LotEvent;

describe("describeLotEvent", () => {
  it("gắn số lô, và bỏ tiền tố với sự kiện cấp phiên", () => {
    expect(describeLotEvent(ev("pause", { reason: "x" }), LOTS).lotLabel).toBe("Lô 2");
    expect(describeLotEvent(ev("finalize", {}, null), LOTS).lotLabel).toBeNull();
  });

  it("lô không có trong map thì không bịa số", () => {
    expect(describeLotEvent(ev("pause", {}, "lot-9"), LOTS).lotLabel).toBeNull();
  });

  it("mở lô có thời lượng nói rõ mở bao lâu", () => {
    const t = describeLotEvent(ev("open", { duration_seconds: 900, ends_at: "2026-10-01T10:15:00Z" }), LOTS);
    expect(t.label).toBe("Mở lô");
    expect(t.detail).toContain("Mở 15 phút");
    expect(t.detail).toContain("đóng lúc");
  });

  it("mở lô không chọn thời lượng thì nói 'đến hết phiên'", () => {
    expect(describeLotEvent(ev("open", { ends_at: "2026-12-31T00:00:00Z" }), LOTS).detail).toContain(
      "đến hết phiên",
    );
  });

  it("tạm dừng nêu lý do và thời gian còn lại", () => {
    const t = describeLotEvent(ev("pause", { reason: "Kiểm tra hồ sơ", remaining_seconds: 150 }), LOTS);
    expect(t.detail).toContain("Kiểm tra hồ sơ");
    expect(t.detail).toContain("2 phút 30 giây");
  });

  it("tiếp tục nói phần thời gian được bù", () => {
    expect(describeLotEvent(ev("resume", { paused_seconds: 45 }), LOTS).detail).toContain("Bù lại 45 giây");
  });

  it("lượt trả giá hiện tiền theo dấu phẩy và số báo danh 3 chữ số", () => {
    const t = describeLotEvent(ev("bid", { amount: 6_400_000_000, bidder_no: 1 }), LOTS);
    expect(t.detail).toContain("6,400,000,000");
    expect(t.detail).toContain("số báo danh 001");
  });

  it("lượt bị từ chối dùng đúng câu người trả giá đã thấy, kèm con số", () => {
    const t = describeLotEvent(
      ev("bid_rejected", { reason: "bid_too_low", amount: 1000, bidder_no: 2, min_amount: 6_450_000_000 }),
      LOTS,
    );
    expect(t.detail).toContain("6,450,000,000");
    expect(t.detail).toContain("số báo danh 002");
  });

  it("gia hạn nêu mốc đóng mới", () => {
    expect(describeLotEvent(ev("extend", { to: "2026-10-01T11:00:00Z" }), LOTS).detail).toContain("Gia hạn đến");
  });

  it("rút giá nêu giá đảo về và việc mất tiền đặt trước", () => {
    const t = describeLotEvent(
      ev("withdraw_bid", { amount: 6_450_000_000, bidder_no: 1, reverted_price: 6_400_000_000, deposit_forfeited: true }),
      LOTS,
    );
    expect(t.detail).toContain("giá về 6,400,000,000");
    expect(t.detail).toContain("không được hoàn trả");
  });

  it("đóng lô phân biệt đấu giá thành và không thành", () => {
    expect(
      describeLotEvent(ev("close", { result: "sold", winning_amount: 6_400_000_000, bidder_no: 1 }), LOTS).detail,
    ).toContain("Đấu giá thành");
    expect(describeLotEvent(ev("close", { result: "unsold" }), LOTS).detail).toContain("Không thành");
  });

  it("rút lô do huỷ phiên được dịch thành câu chữ", () => {
    expect(describeLotEvent(ev("withdraw_lot", { reason: "session_cancelled" }), LOTS).detail).toContain(
      "Phiên bị huỷ",
    );
  });

  it("chốt phiên tóm tắt số lô và số hồ sơ", () => {
    const t = describeLotEvent(
      ev("finalize", { sold: 1, unsold: 1, withdrawn: 0, applied: 1, pending_refund: 1 }, null),
      LOTS,
    );
    expect(t.detail).toContain("1 lô đấu giá thành");
    expect(t.detail).toContain("1 hồ sơ chờ hoàn trả");
  });

  it("biên bản nêu số lần phát hành", () => {
    expect(describeLotEvent(ev("minutes", { sequence_no: 2 }, null), LOTS).detail).toContain("lần 2");
  });

  it("xác nhận thanh toán phân biệt trả và không trả", () => {
    expect(describeLotEvent(ev("payment", { paid: true, winning_amount: 100 }), LOTS).detail).toContain(
      "đã thanh toán",
    );
    expect(describeLotEvent(ev("payment", { paid: false }), LOTS).detail).toContain("KHÔNG thanh toán");
  });

  it("payload rỗng hay lạ vẫn trả nhãn, không ném lỗi", () => {
    expect(describeLotEvent(ev("bid", {}), LOTS).detail).toBe("");
    expect(describeLotEvent(ev("open", { duration_seconds: "bậy" }), LOTS).label).toBe("Mở lô");
    const weird = { ...ev("bid"), kind: "khong_co_that" } as unknown as LotEvent;
    expect(describeLotEvent(weird, LOTS).label).toBe("khong_co_that");
  });
});

describe("actorLabelOf", () => {
  const sources = {
    members: new Map([["u-1", "Nguyễn Văn A"]]),
    bidders: new Map([["u-2", "Trần Thị B"]]),
  };

  it("ưu tiên tên thành viên tổ chức", () => {
    expect(actorLabelOf("u-1", sources)).toBe("Nguyễn Văn A");
  });

  it("lui về họ tên trên hồ sơ tham gia", () => {
    expect(actorLabelOf("u-2", sources)).toBe("Trần Thị B");
  });

  it("không tra được thì KHÔNG đổ UUID ra màn hình", () => {
    expect(actorLabelOf("u-999", sources)).toBe("Thành viên tổ chức");
  });

  it("actor rỗng là pg_cron, không phải thiếu dữ liệu", () => {
    expect(actorLabelOf(null, sources)).toBe(SYSTEM_ACTOR_LABEL);
    expect(actorLabelOf(undefined, sources)).toBe(SYSTEM_ACTOR_LABEL);
  });
});
