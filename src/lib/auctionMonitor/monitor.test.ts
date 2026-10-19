import { describe, expect, it } from "vitest";
import {
  countByTab,
  isVisibleOnAuctionSite,
  liveLotCount,
  matchesMonitorSearch,
  monitorStateOf,
  upcomingDetailOf,
  type AdminAuctionSessionRow,
} from "./monitor";

const NOW = new Date("2026-10-19T10:00:00Z");

const row = (over: Partial<AdminAuctionSessionRow> = {}): AdminAuctionSessionRow => ({
  id: "s1",
  code: "PDG000014",
  title: "Quyền sử dụng đất Nam Định",
  status: "published",
  auction_format: "truc_tuyen",
  bidding_method: "ascending",
  province: "Nam Định",
  org_name: "Công ty Đấu giá Hợp danh Việt Nam",
  registration_end_at: "2026-10-25T09:00:00Z",
  starts_at: "2026-10-26T02:00:00Z",
  ends_at: "2026-10-26T04:00:00Z",
  published_at: "2026-10-01T00:00:00Z",
  finalized_at: "",
  cancelled_reason: "",
  created_at: "2026-09-30T00:00:00Z",
  lot_count: 2,
  live_lot_count: 0,
  closed_lot_count: 0,
  sold_lot_count: 0,
  dossier_count: 3,
  paid_dossier_count: 2,
  checked_in_count: 0,
  sale_contract_count: 0,
  ...over,
});

describe("monitorStateOf", () => {
  it("keeps draft and cancelled regardless of time", () => {
    expect(monitorStateOf(row({ status: "draft" }), NOW)).toBe("draft");
    expect(monitorStateOf(row({ status: "cancelled", live_lot_count: 1 }), NOW)).toBe("cancelled");
  });

  it("derives upcoming / live / ended from the schedule", () => {
    expect(monitorStateOf(row(), NOW)).toBe("upcoming");
    expect(monitorStateOf(row({ starts_at: "2026-10-19T09:00:00Z", ends_at: "2026-10-19T11:00:00Z" }), NOW)).toBe("live");
    expect(monitorStateOf(row({ starts_at: "2026-10-18T09:00:00Z", ends_at: "2026-10-18T11:00:00Z" }), NOW)).toBe("ended");
  });

  it("treats an open lot as live even past the scheduled end (extensions)", () => {
    expect(
      monitorStateOf(row({ starts_at: "2026-10-18T09:00:00Z", ends_at: "2026-10-18T11:00:00Z", live_lot_count: 1 }), NOW),
    ).toBe("live");
  });
});

describe("upcomingDetailOf", () => {
  it("says whether dossiers are still on sale", () => {
    expect(upcomingDetailOf(row(), NOW)).toBe("Đang bán hồ sơ");
    expect(upcomingDetailOf(row({ registration_end_at: "2026-10-19T09:00:00Z" }), NOW)).toBe("Sắp diễn ra");
    expect(upcomingDetailOf(row({ status: "draft" }), NOW)).toBeNull();
  });
});

describe("matchesMonitorSearch", () => {
  it("matches code, title, org and province without diacritics", () => {
    expect(matchesMonitorSearch(row(), "pdg000014")).toBe(true);
    expect(matchesMonitorSearch(row(), "nam dinh")).toBe(true);
    expect(matchesMonitorSearch(row(), "hop danh viet")).toBe(true);
    expect(matchesMonitorSearch(row(), "bảo tín")).toBe(false);
    expect(matchesMonitorSearch(row(), "  ")).toBe(true);
  });
});

describe("countByTab", () => {
  it("counts every session once", () => {
    const c = countByTab(
      [row(), row({ status: "draft" }), row({ starts_at: "2026-10-19T09:00:00Z", ends_at: "2026-10-19T11:00:00Z" })],
      NOW,
    );
    expect(c).toEqual({ "tat-ca": 3, live: 1, upcoming: 1, ended: 0, draft: 1, cancelled: 0 });
  });
});

describe("helpers", () => {
  it("links out only for published sessions", () => {
    expect(isVisibleOnAuctionSite({ status: "published" })).toBe(true);
    expect(isVisibleOnAuctionSite({ status: "draft" })).toBe(false);
  });

  it("counts live lots", () => {
    const lot = (state: "open" | "closed" | "tied" | null) => ({ state }) as never;
    expect(liveLotCount({ lots: [lot("open"), lot("closed"), lot("tied"), lot(null)] })).toBe(2);
    expect(liveLotCount(null)).toBe(0);
  });
});
