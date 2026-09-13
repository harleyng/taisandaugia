import { describe, expect, it } from "vitest";
import { roomGateOf, type RoomGateInput, type RoomGateSession } from "./roomAccess";

const NOW = new Date("2026-10-01T10:00:00Z");

const session = (patch: Partial<RoomGateSession> = {}): RoomGateSession => ({
  status: "published",
  auction_format: "ca_hai",
  bidding_method: "ascending",
  starts_at: "2026-09-01T00:00:00Z",
  ...patch,
});

const input = (patch: Partial<RoomGateInput> = {}): RoomGateInput => ({
  sessionLoading: false,
  session: session(),
  bidderLoading: false,
  eligible: true,
  reason: null,
  forfeited: false,
  bidderNo: 1,
  now: NOW,
  ...patch,
});

describe("roomGateOf", () => {
  it("đủ điều kiện thì mở phòng", () => {
    expect(roomGateOf(input())).toEqual({ kind: "open" });
  });

  it("đang tải phiên thì chưa kết luận gì", () => {
    expect(roomGateOf(input({ sessionLoading: true, session: null }))).toEqual({ kind: "loading" });
  });

  it("không có phiên hoặc phiên nháp = không tìm thấy", () => {
    expect(roomGateOf(input({ session: null }))).toEqual({ kind: "not_found" });
    expect(roomGateOf(input({ session: session({ status: "draft" }) }))).toEqual({ kind: "not_found" });
  });

  it("phiên đã huỷ có nhánh riêng, không lẫn với 'không trực tuyến'", () => {
    expect(roomGateOf(input({ session: session({ status: "cancelled" }) }))).toEqual({ kind: "cancelled" });
  });

  it("phiên trực tiếp tại hội trường không có phòng trực tuyến", () => {
    expect(roomGateOf(input({ session: session({ auction_format: "truc_tiep" }) }))).toEqual({ kind: "not_online" });
  });

  it("cả truc_tuyen lẫn ca_hai đều mở được phòng", () => {
    expect(roomGateOf(input({ session: session({ auction_format: "truc_tuyen" }) }))).toEqual({ kind: "open" });
  });

  it("hình thức ngoài trả giá lên thì chưa hỗ trợ", () => {
    expect(roomGateOf(input({ session: session({ bidding_method: "descending" }) }))).toEqual({
      kind: "method_unsupported",
    });
  });

  it("chưa tới giờ bắt đầu thì báo giờ mở, không bày phòng rỗng", () => {
    // place_bid trả session_not_live trước starts_at.
    const s = session({ starts_at: "2026-12-01T00:00:00Z" });
    expect(roomGateOf(input({ session: s }))).toEqual({ kind: "not_started", startsAt: s.starts_at });
  });

  it("đúng mốc starts_at là đã mở", () => {
    expect(roomGateOf(input({ session: session({ starts_at: NOW.toISOString() }) }))).toEqual({ kind: "open" });
  });

  it("chặn cả trang khi chưa đủ điều kiện, kèm đúng lý do", () => {
    expect(roomGateOf(input({ eligible: false, reason: "no_contract" }))).toEqual({
      kind: "blocked",
      reason: "no_contract",
    });
    expect(roomGateOf(input({ eligible: false, reason: "login_required" }))).toEqual({
      kind: "blocked",
      reason: "login_required",
    });
  });

  it("đang tải trạng thái người trả giá thì chưa chặn vội", () => {
    // useMyBidderStatus trả reason=null lúc loading — chặn lúc này là hiện câu sai.
    expect(roomGateOf(input({ bidderLoading: true, eligible: false, reason: null }))).toEqual({ kind: "loading" });
  });

  it("đã rút giá (tiền đặt trước bị tịch thu) có nhánh RIÊNG, không báo 'chưa nộp tiền'", () => {
    const gate = roomGateOf(input({ forfeited: true, eligible: false, reason: "no_deposit" }));
    expect(gate).toEqual({ kind: "view_only", reason: "forfeited" });
  });

  it("kiểm phiên trước kiểm người: phiên huỷ thì không hỏi điều kiện nữa", () => {
    expect(roomGateOf(input({ session: session({ status: "cancelled" }), eligible: false, reason: "no_contract" })))
      .toEqual({ kind: "cancelled" });
  });
});

describe("roomGateOf — sau khi chốt kết quả (Bước 6)", () => {
  it("tiền đặt trước đã chuyển / chờ hoàn ⇒ vào xem được, không trả giá", () => {
    for (const reason of ["settled"] as const) {
      const gate = roomGateOf(input({ eligible: false, reason }));
      expect(gate).toEqual({ kind: "view_only", reason: "settled" });
    }
  });

  it("đã hoàn trả tiền đặt trước ⇒ vào xem được với câu riêng", () => {
    const gate = roomGateOf(input({ eligible: false, reason: "refunded" }));
    expect(gate).toEqual({ kind: "view_only", reason: "refunded" });
  });

  it("chỉ-xem mà CHƯA có số báo danh thì nói thẳng, không để màn trắng", () => {
    const gate = roomGateOf(input({ eligible: false, reason: "settled", bidderNo: null }));
    expect(gate).toEqual({ kind: "blocked", reason: "no_bidder_no" });
    const forfeit = roomGateOf(input({ forfeited: true, eligible: false, bidderNo: null }));
    expect(forfeit).toEqual({ kind: "blocked", reason: "no_bidder_no" });
  });

  it("tịch thu thắng settled khi cả hai cùng đúng", () => {
    const gate = roomGateOf(input({ forfeited: true, eligible: false, reason: "settled" }));
    expect(gate).toEqual({ kind: "view_only", reason: "forfeited" });
  });

  it("settled vẫn thua các cổng về phiên", () => {
    const blocked = { eligible: false, reason: "settled" } as const;
    expect(roomGateOf(input({ ...blocked, session: session({ status: "cancelled" }) }))).toEqual({ kind: "cancelled" });
    expect(roomGateOf(input({ ...blocked, session: session({ auction_format: "truc_tiep" }) }))).toEqual({
      kind: "not_online",
    });
    expect(
      roomGateOf(input({ ...blocked, session: session({ starts_at: "2026-12-01T00:00:00Z" }) })).kind,
    ).toBe("not_started");
  });

  it("phiên đã chốt nhưng hồ sơ vẫn 'đã nhận' thì phòng vẫn mở bình thường", () => {
    expect(roomGateOf(input())).toEqual({ kind: "open" });
  });

  it("no_deposit thật (chưa nộp tiền) vẫn bị chặn cả trang", () => {
    expect(roomGateOf(input({ eligible: false, reason: "no_deposit" }))).toEqual({
      kind: "blocked",
      reason: "no_deposit",
    });
  });
});
