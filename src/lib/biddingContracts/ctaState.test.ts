import { describe, expect, it } from "vitest";
import { contractCtaState, type CtaContract, type CtaSession } from "./ctaState";

const now = new Date("2026-10-01T03:00:00Z");
const session = (patch: Partial<CtaSession> = {}): CtaSession => ({
  status: "published",
  starts_at: "2026-10-10T02:00:00Z",
  registration_start_at: "2026-09-25T01:00:00Z",
  registration_end_at: "2026-10-08T10:00:00Z",
  max_registrants: 10,
  dossier_fee: 200_000,
  ...patch,
});
const summary = { paid_count: 2, held_count: 1, sale_enabled: true };
const base = { session: session(), contract: null as CtaContract | null, summary, userId: "u1", now };

describe("contractCtaState", () => {
  it("đủ điều kiện ⇒ available", () => {
    expect(contractCtaState(base).kind).toBe("available");
  });

  it("chưa đăng nhập ⇒ login_required", () => {
    expect(contractCtaState({ ...base, userId: null }).kind).toBe("login_required");
  });

  it("đã trả tiền thắng mọi trạng thái khác, kể cả phiên huỷ", () => {
    const s = session({ status: "cancelled" });
    expect(contractCtaState({ ...base, session: s, contract: { status: "paid" } }).kind).toBe("paid");
  });

  it("phiên huỷ ⇒ cancelled_session", () => {
    expect(contractCtaState({ ...base, session: session({ status: "cancelled" }) }).kind).toBe("cancelled_session");
  });

  it("hết hạn nộp hoặc đã tới giờ đấu ⇒ closed", () => {
    expect(contractCtaState({ ...base, now: new Date("2026-10-09T00:00:00Z") }).kind).toBe("closed");
    const noDeadline = session({ registration_end_at: null });
    expect(contractCtaState({ ...base, session: noDeadline, now: new Date("2026-10-10T02:00:00Z") }).kind).toBe(
      "closed",
    );
  });

  it("chưa đặt giá hồ sơ hoặc tổ chức chưa có hợp đồng ⇒ not_for_sale", () => {
    expect(contractCtaState({ ...base, session: session({ dossier_fee: null }) }).kind).toBe("not_for_sale");
    expect(contractCtaState({ ...base, session: session({ dossier_fee: 0 }) }).kind).toBe("not_for_sale");
    expect(contractCtaState({ ...base, summary: { ...summary, sale_enabled: false } }).kind).toBe("not_for_sale");
  });

  it("trước ngày mở bán ⇒ not_open_yet kèm mốc mở", () => {
    const r = contractCtaState({ ...base, now: new Date("2026-09-20T00:00:00Z") });
    expect(r).toEqual({ kind: "not_open_yet", opensAt: "2026-09-25T01:00:00Z" });
  });

  it("đang giữ chỗ ⇒ pending, ưu tiên hơn full", () => {
    const full = { paid_count: 9, held_count: 1, sale_enabled: true };
    expect(contractCtaState({ ...base, summary: full, contract: { status: "pending_payment" } }).kind).toBe("pending");
  });

  it("paid + đang giữ chỗ chạm trần ⇒ full; không giới hạn thì không bao giờ full", () => {
    const full = { paid_count: 9, held_count: 1, sale_enabled: true };
    expect(contractCtaState({ ...base, summary: full }).kind).toBe("full");
    expect(contractCtaState({ ...base, summary: full, session: session({ max_registrants: null }) }).kind).toBe(
      "available",
    );
  });

  it("summary chưa tải ⇒ dựa vào giá hồ sơ, không báo full", () => {
    expect(contractCtaState({ ...base, summary: null }).kind).toBe("available");
  });
});
