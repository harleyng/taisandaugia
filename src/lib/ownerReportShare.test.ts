import { describe, expect, it } from "vitest";
import {
  CONTROL_TOWER_CONTACT_HREF,
  formatShareDateTime,
  formatShareDay,
  mapShareLink,
  mapShareResult,
  mapSharedReportResponse,
  reportShareState,
  shareListLabel,
  shareStatusLine,
  sharedReportPath,
  sharedReportUrl,
} from "./ownerReportShare";
import { RAW_REPORT_PAYLOAD } from "./ownerPeriodicReport.fixture";
import type { ReportShareInfo } from "./ownerPeriodicReport";

const NOW = new Date("2026-09-27T03:00:00Z");
const TOKEN = "Ab3_-".padEnd(43, "x");

const share = (over: Partial<ReportShareInfo> = {}): ReportShareInfo => ({
  expiresAt: null,
  viewCount: 0,
  lastViewedAt: null,
  sharedAt: null,
  sharedBy: null,
  ...over,
});

describe("share state", () => {
  it("is none without an expiry, active before it and expired after it", () => {
    expect(reportShareState(share(), NOW)).toBe("none");
    expect(reportShareState(share({ expiresAt: "garbage" }), NOW)).toBe("none");
    expect(reportShareState(share({ expiresAt: "2026-10-27T03:00:00Z" }), NOW)).toBe("active");
    expect(reportShareState(share({ expiresAt: "2026-09-27T03:00:00Z" }), NOW)).toBe("expired");
    expect(reportShareState(share({ expiresAt: "2026-09-20T03:00:00Z" }), NOW)).toBe("expired");
  });

  it("formats dates in Vietnam time, whatever the viewer's zone", () => {
    // 17:30 UTC = 00:30 hôm sau ở VN.
    expect(formatShareDay("2026-10-26T17:30:00Z")).toBe("27/10/2026");
    expect(formatShareDateTime("2026-10-26T17:30:00Z")).toBe("27/10/2026 00:30");
    expect(formatShareDay(null)).toBe("—");
    expect(formatShareDateTime("nope")).toBe("—");
  });

  it("describes the link status in one line", () => {
    const active = share({ expiresAt: "2026-10-27T03:00:00Z", viewCount: 1234, lastViewedAt: "2026-09-26T02:05:00Z" });
    expect(shareStatusLine(active, "active")).toBe("Hết hạn 27/10/2026 · 1,234 lượt xem · xem lần cuối 26/09/2026 09:05");
    expect(shareStatusLine(share({ expiresAt: "2026-09-20T03:00:00Z" }), "expired")).toBe(
      "Đã hết hạn ngày 20/09/2026 · chưa có lượt xem",
    );
    expect(shareStatusLine(share({ viewCount: 3 }), "none")).toBe("3 lượt xem");
  });

  it("labels only active links in the report list", () => {
    expect(shareListLabel(share({ expiresAt: "2026-10-27T03:00:00Z", viewCount: 2 }), NOW)).toBe("Đang chia sẻ · 2 lượt xem");
    expect(shareListLabel(share({ expiresAt: "2026-09-01T00:00:00Z", viewCount: 2 }), NOW)).toBeNull();
    expect(shareListLabel(share(), NOW)).toBeNull();
  });
});

describe("links", () => {
  it("builds the public path and URL", () => {
    expect(sharedReportPath(TOKEN)).toBe(`/r/${TOKEN}`);
    expect(sharedReportUrl(TOKEN, "https://taisandaugia.vn")).toBe(`https://taisandaugia.vn/r/${TOKEN}`);
  });

  it("points the CTA at the contact page with the topic prefilled", () => {
    expect(CONTROL_TOWER_CONTACT_HREF).toBe("/lien-he?chu-de=Th%C3%A1p%20%C4%90i%E1%BB%81u%20H%C3%A0nh");
    expect(new URLSearchParams(CONTROL_TOWER_CONTACT_HREF.split("?")[1]).get("chu-de")).toBe("Tháp Điều Hành");
  });
});

describe("RPC results", () => {
  it("maps the owner's share link", () => {
    expect(mapShareLink({ ok: true, token: TOKEN, expires_at: "2026-10-27T03:00:00Z" })).toEqual({
      token: TOKEN,
      expiresAt: "2026-10-27T03:00:00Z",
    });
    expect(mapShareLink({ ok: true, token: null, expires_at: null })).toEqual({ token: null, expiresAt: null });
  });

  it("maps a created / renewed link and refuses one without a token", () => {
    expect(mapShareResult({ ok: true, token: TOKEN, expires_at: "x", renewed: true })).toEqual({
      token: TOKEN,
      expiresAt: "x",
      renewed: true,
    });
    expect(mapShareResult({ ok: true, token: TOKEN }).renewed).toBe(false);
    expect(() => mapShareResult({ ok: true })).toThrow();
  });
});

describe("mapSharedReportResponse", () => {
  it("returns the payload of a live link", () => {
    const r = mapSharedReportResponse({
      ok: true,
      report: { payload: RAW_REPORT_PAYLOAD, expires_at: "2026-10-27T03:00:00Z" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.meta.period.start).toBe("2026-09-01");
      expect(r.expiresAt).toBe("2026-10-27T03:00:00Z");
    }
  });

  it("tells expired links apart from unknown or revoked ones", () => {
    expect(mapSharedReportResponse({ ok: false, reason: "expired", expired_at: "2026-09-20T00:00:00Z" })).toEqual({
      ok: false,
      reason: "expired",
      expiredAt: "2026-09-20T00:00:00Z",
    });
    expect(mapSharedReportResponse({ ok: false, reason: "not_found" })).toEqual({
      ok: false,
      reason: "not_found",
      expiredAt: null,
    });
    expect(mapSharedReportResponse({ ok: false, reason: "something_new" })).toMatchObject({ reason: "not_found" });
  });

  it("does not trust a response it cannot read", () => {
    expect(mapSharedReportResponse({ ok: true, report: { payload: { meta: {} } } })).toMatchObject({
      ok: false,
      reason: "unreadable",
    });
    expect(mapSharedReportResponse(null)).toMatchObject({ ok: false, reason: "unreadable" });
  });
});
