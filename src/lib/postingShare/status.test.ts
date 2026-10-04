import { describe, expect, it } from "vitest";
import {
  assertShareRpcOk,
  expiryDays,
  formatShareDay,
  PostingShareRpcError,
  SHARE_EXPIRY_OPTIONS,
  shareLinkState,
  shareLinkStateNote,
} from "./status";

const now = new Date("2026-10-01T05:00:00Z");

describe("shareLinkState", () => {
  it("thu hồi thắng hết hạn", () => {
    expect(shareLinkState({ revokedAt: "2026-09-30T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z" }, now)).toBe("revoked");
  });
  it("hết hạn đúng tại mốc", () => {
    expect(shareLinkState({ revokedAt: null, expiresAt: "2026-10-01T05:00:00Z" }, now)).toBe("expired");
    expect(shareLinkState({ revokedAt: null, expiresAt: "2026-10-01T05:00:01Z" }, now)).toBe("active");
  });
  it("không hạn = đang mở", () => {
    expect(shareLinkState({ revokedAt: null, expiresAt: null }, now)).toBe("active");
  });
});

describe("shareLinkStateNote + ngày theo giờ VN", () => {
  it("23:30 UTC đã là ngày hôm sau ở Việt Nam", () => {
    expect(formatShareDay("2026-10-25T23:30:00Z")).toBe("26/10/2026");
    expect(formatShareDay(null)).toBe("—");
  });
  it("câu phụ theo trạng thái", () => {
    expect(shareLinkStateNote({ revokedAt: null, expiresAt: null }, now)).toBe("không hết hạn");
    expect(shareLinkStateNote({ revokedAt: null, expiresAt: "2026-10-31T00:00:00Z" }, now)).toBe("đến 31/10/2026");
    expect(shareLinkStateNote({ revokedAt: null, expiresAt: "2026-09-01T00:00:00Z" }, now)).toBe("ngày 01/09/2026");
  });
});

describe("thời hạn", () => {
  it("7 / 30 / 90 ngày / không hết hạn — trong khoảng server nhận (1–365 hoặc null)", () => {
    expect(SHARE_EXPIRY_OPTIONS.map((o) => o.value)).toEqual(["7", "30", "90", "none"]);
    expect(expiryDays("30")).toBe(30);
    expect(expiryDays("none")).toBeNull();
    for (const o of SHARE_EXPIRY_OPTIONS) if (o.days !== null) expect(o.days).toBeGreaterThanOrEqual(1);
  });
});

describe("assertShareRpcOk", () => {
  it("ok:false ⇒ ném lỗi tiếng Việt theo reason", () => {
    expect(() => assertShareRpcOk({ ok: false, reason: "not_approved" })).toThrow(PostingShareRpcError);
    expect(() => assertShareRpcOk({ ok: false, reason: "not_approved" })).toThrow(/sàn duyệt/);
    expect(() => assertShareRpcOk({ ok: true })).not.toThrow();
  });
});
