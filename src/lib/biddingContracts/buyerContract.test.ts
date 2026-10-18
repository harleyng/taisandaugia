import { describe, expect, it } from "vitest";
import {
  actionOf,
  buyerDepositStateOf,
  buyerGroupOf,
  headlineOf,
  noteOf,
  progressStepOf,
  type BuyerContractLike,
} from "./buyerContract";

const NOW = new Date("2026-10-18T08:00:00Z");

const base = (over: Partial<BuyerContractLike> = {}, s: Partial<NonNullable<BuyerContractLike["auction_sessions"]>> = {}): BuyerContractLike => ({
  status: "paid",
  review_status: "approved",
  deposit_status: "pending",
  deposit_reported_at: null,
  hold_expires_at: null,
  checked_in_at: null,
  absent_at: null,
  bidder_no: null,
  review_note: null,
  ...over,
  auction_sessions: {
    status: "published",
    auction_format: "truc_tuyen",
    starts_at: "2026-10-22T02:00:00Z",
    ends_at: "2026-10-22T05:00:00Z",
    finalized_at: null,
    registration_end_at: "2026-10-20T10:00:00Z",
    checkin_lead_minutes: 30,
    checkin_grace_minutes: 15,
    ...s,
  },
});

describe("buyerGroupOf", () => {
  it("ẩn hồ sơ đã huỷ và hồ sơ chờ thanh toán khi phiên đã bắt đầu", () => {
    expect(buyerGroupOf(base({ status: "cancelled" }), NOW)).toBeNull();
    expect(buyerGroupOf(base({ status: "pending_payment" }, { starts_at: "2026-10-17T00:00:00Z" }), NOW)).toBeNull();
  });
  it("phiên huỷ / hồ sơ bị từ chối ⇒ Đã huỷ", () => {
    expect(buyerGroupOf(base({}, { status: "cancelled" }), NOW)).toBe("cancelled");
    expect(buyerGroupOf(base({ status: "refunded" }), NOW)).toBe("cancelled");
  });
  it("phiên đã chốt hoặc quá giờ ⇒ Đã kết thúc", () => {
    expect(buyerGroupOf(base({}, { finalized_at: "2026-10-17T00:00:00Z" }), NOW)).toBe("done");
    expect(buyerGroupOf(base({}, { ends_at: "2026-10-17T00:00:00Z", starts_at: "2026-10-16T00:00:00Z" }), NOW)).toBe("done");
    expect(buyerGroupOf(base(), NOW)).toBe("active");
  });
});

describe("tiền đặt trước", () => {
  it("pending + đã báo nộp ⇒ sent", () => {
    expect(buyerDepositStateOf({ deposit_status: "pending", deposit_reported_at: "x" })).toBe("sent");
    expect(buyerDepositStateOf({ deposit_status: "received", deposit_reported_at: "x" })).toBe("received");
  });
});

describe("tiến độ + nhãn + việc tiếp theo", () => {
  it("chờ thanh toán", () => {
    const c = base({ status: "pending_payment", hold_expires_at: "2026-10-18T08:10:00Z" });
    expect(progressStepOf(c, NOW)).toBe(0);
    expect(headlineOf(c, { now: NOW }).label).toBe("Chờ thanh toán phí hồ sơ");
    expect(actionOf(c, { now: NOW }).kind).toBe("pay");
    expect(noteOf(c, { now: NOW })?.warn).toBe(true);
  });
  it("đã duyệt, chưa nộp ⇒ nộp đặt trước, ghi hạn", () => {
    const c = base();
    expect(progressStepOf(c, NOW)).toBe(1);
    expect(headlineOf(c, { now: NOW }).label).toBe("Chờ nộp đặt trước");
    expect(actionOf(c, { now: NOW })).toMatchObject({ kind: "deposit", primary: true });
    expect(noteOf(c, { now: NOW })?.text).toContain("còn 3 ngày");
  });
  it("đã báo nộp ⇒ chờ đối soát, nút phụ", () => {
    const c = base({ deposit_reported_at: "2026-10-18T07:00:00Z" });
    expect(headlineOf(c, { now: NOW }).tone).toBe("pri");
    expect(actionOf(c, { now: NOW })).toMatchObject({ kind: "deposit", primary: false });
  });
  it("cần bổ sung đứng trước tiền đặt trước", () => {
    const c = base({ review_status: "needs_info", review_note: "Ảnh mờ" });
    expect(actionOf(c, { now: NOW }).kind).toBe("resubmit");
    expect(noteOf(c, { now: NOW })?.text).toBe("Ảnh mờ");
  });
  it("đủ điều kiện ⇒ chặng điểm danh", () => {
    const c = base({ deposit_status: "received" });
    expect(progressStepOf(c, NOW)).toBe(2);
    expect(headlineOf(c, { now: NOW }).label).toBe("Đủ điều kiện · chờ điểm danh");
    expect(actionOf(c, { now: NOW }).kind).toBe("detail");
  });
  it("đang đấu + đã điểm danh ⇒ vào phòng", () => {
    const now = new Date("2026-10-22T03:00:00Z");
    const c = base({ deposit_status: "received", checked_in_at: "2026-10-22T01:50:00Z", bidder_no: 21 });
    expect(progressStepOf(c, now)).toBe(3);
    expect(headlineOf(c, { now }).tone).toBe("live");
    expect(actionOf(c, { now }).kind).toBe("room");
    expect(noteOf(c, { now })?.text).toBe("Số báo danh 021");
  });
  it("kết thúc: trúng ⇒ Xem kết quả", () => {
    const c = base({ deposit_status: "applied" }, { finalized_at: "2026-10-17T00:00:00Z" });
    expect(progressStepOf(c, NOW)).toBe(5);
    expect(headlineOf(c, { now: NOW, wonCount: 1 }).label).toBe("Trúng 1 tài sản");
    expect(actionOf(c, { now: NOW, wonCount: 1 }).kind).toBe("result");
    expect(headlineOf(c, { now: NOW }).label).toBe("Không trúng");
  });
});

describe("chặng điểm danh (design hs-mine.js)", () => {
  const OPEN = new Date("2026-10-22T01:45:00Z"); // cửa sổ 01:30–02:15Z
  const ok = { deposit_status: "received" as const };

  it("trực tuyến đang mở ⇒ Điểm danh ngay + cảnh báo giờ đóng", () => {
    const c = base(ok);
    expect(headlineOf(c, { now: OPEN })).toEqual({ label: "Đang mở điểm danh", tone: "live" });
    expect(actionOf(c, { now: OPEN })).toMatchObject({ kind: "checkin", label: "Điểm danh ngay", primary: true });
    expect(noteOf(c, { now: OPEN })).toMatchObject({ warn: true });
    expect(noteOf(c, { now: OPEN })?.text).toContain("Đóng điểm danh lúc");
  });
  it("trực tiếp: chưa mở ⇒ xem phiếu (phụ); đang mở ⇒ mở phiếu (chính)", () => {
    const c = base(ok, { auction_format: "truc_tiep" });
    expect(actionOf(c, { now: NOW })).toMatchObject({ kind: "ticket", label: "Xem phiếu dự phiên", primary: false });
    expect(actionOf(c, { now: OPEN })).toMatchObject({ kind: "ticket", label: "Mở phiếu dự phiên", primary: true });
  });
  it("trực tuyến chưa mở ⇒ chỉ xem hồ sơ", () => {
    expect(actionOf(base(ok), { now: NOW }).kind).toBe("detail");
  });
  it("đã điểm danh trước giờ đấu ⇒ nút phụ vào phòng", () => {
    const c = base({ ...ok, checked_in_at: "2026-10-22T01:40:00Z", bidder_no: 7 });
    expect(actionOf(c, { now: OPEN })).toMatchObject({ kind: "room", primary: false });
    expect(actionOf(c, { now: OPEN }).label).toMatch(/^Vào phòng · mở /);
    expect(actionOf(base({ ...ok, checked_in_at: "x" }, { auction_format: "truc_tiep" }), { now: OPEN }).kind).toBe("detail");
  });
  it("vắng ⇒ dừng ở chặng Điểm danh, đặt trước bị tịch thu", () => {
    const c = base({ deposit_status: "forfeited", absent_at: "2026-10-22T02:16:00Z" });
    const now = new Date("2026-10-22T02:30:00Z");
    expect(progressStepOf(c, now)).toBe(2);
    expect(headlineOf(c, { now })).toEqual({ label: "Vắng — không điểm danh", tone: "red" });
    expect(noteOf(c, { now })?.text).toBe("Tiền đặt trước bị tịch thu");
    expect(noteOf({ ...c, absence_appeal_at: "2026-10-22T03:00:00Z" }, { now })?.text).toBe(
      "Đã gửi lý do vắng · chờ tổ chức xem xét",
    );
  });
});
