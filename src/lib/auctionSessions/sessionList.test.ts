import { describe, expect, it } from "vitest";
import type { OrgSessionListRow } from "@/types/auction-session";
import {
  customRangeError,
  matchesSessionQuery,
  matchesTab,
  matchesTime,
  paginate,
  sessionRowState,
  sortSessionRows,
  timeFilterLabel,
} from "./sessionList";

const NOW = new Date("2026-10-10T10:00");

const row = (p: Partial<OrgSessionListRow> & { id: string }): OrgSessionListRow =>
  ({
    code: "PDG000001",
    title: "Phiên",
    province: null,
    venue: null,
    status: "published",
    starts_at: "2026-10-22T09:00",
    ends_at: "2026-10-22T11:00",
    registration_end_at: null,
    finalized_at: null,
    item_titles: [],
    item_count: 0,
    total_starting_price: 0,
    sold_count: 0,
    ...p,
  }) as OrgSessionListRow;

describe("sessionRowState", () => {
  it("nháp / huỷ theo vòng đời; đã công bố theo mốc thời gian", () => {
    expect(sessionRowState(row({ id: "a", status: "draft" }), NOW)).toBe("draft");
    expect(sessionRowState(row({ id: "b", status: "cancelled" }), NOW)).toBe("cancelled");
    expect(sessionRowState(row({ id: "c" }), NOW)).toBe("reg");
    expect(sessionRowState(row({ id: "d", registration_end_at: "2026-10-08T17:00" }), NOW)).toBe("upcoming");
    expect(sessionRowState(row({ id: "e", starts_at: "2026-10-10T09:00", ends_at: "2026-10-10T11:30" }), NOW)).toBe(
      "ongoing",
    );
    expect(sessionRowState(row({ id: "f", starts_at: "2026-09-30T09:00", ends_at: "2026-09-30T11:00" }), NOW)).toBe(
      "ended",
    );
  });

  it("đã chốt kết quả thắng giai đoạn thời gian", () => {
    expect(
      sessionRowState(row({ id: "a", starts_at: "2026-09-30T09:00", ends_at: "2026-09-30T11:00", finalized_at: "x" }), NOW),
    ).toBe("finalized");
  });
});

describe("sortSessionRows", () => {
  it("đang diễn ra → sắp tới (gần trước) → nháp → đã xong (mới trước) → huỷ", () => {
    const rows = [
      row({ id: "cancel", status: "cancelled", starts_at: "2026-09-29T09:00" }),
      row({ id: "old", starts_at: "2026-09-22T09:00", ends_at: "2026-09-22T10:30" }),
      row({ id: "recent", starts_at: "2026-09-30T09:00", ends_at: "2026-09-30T11:00" }),
      row({ id: "draft", status: "draft", starts_at: "2026-11-20T09:00" }),
      row({ id: "far", starts_at: "2026-10-22T09:00" }),
      row({ id: "near", starts_at: "2026-10-12T14:00", ends_at: "2026-10-12T16:00" }),
      row({ id: "live", starts_at: "2026-10-10T09:00", ends_at: "2026-10-10T11:30" }),
    ];
    expect(sortSessionRows(rows, NOW).map((r) => r.id)).toEqual([
      "live",
      "near",
      "far",
      "draft",
      "recent",
      "old",
      "cancel",
    ]);
  });
});

describe("matchesTab", () => {
  it("tab Đang công bố gồm mọi giai đoạn chưa kết thúc", () => {
    expect(matchesTab("published", row({ id: "a" }), NOW)).toBe(true);
    expect(matchesTab("ended", row({ id: "a", starts_at: "2026-09-30T09:00", ends_at: "2026-09-30T11:00" }), NOW)).toBe(
      true,
    );
    expect(matchesTab("tat-ca", row({ id: "a", status: "draft" }), NOW)).toBe(true);
  });
});

describe("matchesTime", () => {
  const s = (starts: string) => ({ starts_at: starts, ends_at: starts });
  it("cửa sổ tính từ đầu ngày hôm nay", () => {
    expect(matchesTime(s("2026-10-10T08:00"), "today", "", "", NOW)).toBe(true);
    expect(matchesTime(s("2026-10-11T08:00"), "today", "", "", NOW)).toBe(false);
    expect(matchesTime(s("2026-10-16T23:00"), "w7", "", "", NOW)).toBe(true);
    expect(matchesTime(s("2026-10-17T00:00"), "w7", "", "", NOW)).toBe(false);
    expect(matchesTime(s("2026-10-31T23:00"), "month", "", "", NOW)).toBe(true);
    expect(matchesTime(s("2026-09-30T09:00"), "past", "", "", NOW)).toBe(true);
  });

  it("khoảng tuỳ chỉnh bao trọn ngày cuối; hở một đầu được", () => {
    expect(matchesTime(s("2026-10-22T20:00"), "custom", "2026-10-01", "2026-10-22", NOW)).toBe(true);
    expect(matchesTime(s("2026-10-23T00:00"), "custom", "2026-10-01", "2026-10-22", NOW)).toBe(false);
    expect(matchesTime(s("2026-12-01T00:00"), "custom", "2026-10-01", "", NOW)).toBe(true);
  });

  it("nhãn + lỗi khoảng tuỳ chỉnh", () => {
    expect(timeFilterLabel("custom", "2026-10-01", "")).toBe("01/10/2026 – …");
    expect(timeFilterLabel("", "", "")).toBe("Mọi thời gian");
    expect(customRangeError("", "")).toBe("Chọn ít nhất một ngày");
    expect(customRangeError("2026-10-05", "2026-10-01")).toBe("Đến ngày phải sau Từ ngày");
    expect(customRangeError("2026-10-01", "")).toBeNull();
  });
});

describe("matchesSessionQuery", () => {
  it("tìm không dấu theo mã, tên, địa điểm, tên tài sản", () => {
    const s = row({ id: "a", code: "PDG000131", venue: "Hội trường tầng 3", item_titles: ["Thửa 214, tờ 12"] });
    expect(matchesSessionQuery(s, "pdg000131")).toBe(true);
    expect(matchesSessionQuery(s, "hoi truong")).toBe(true);
    expect(matchesSessionQuery(s, "thua 214")).toBe(true);
    expect(matchesSessionQuery(s, "o to")).toBe(false);
  });
});

describe("paginate", () => {
  it("kẹp trang vào khoảng hợp lệ", () => {
    const rows = Array.from({ length: 23 }, (_, i) => i);
    expect(paginate(rows, 3, 10)).toMatchObject({ pages: 3, page: 3, start: 20, slice: [20, 21, 22] });
    expect(paginate(rows, 9, 10).page).toBe(3);
    expect(paginate([], 1, 10)).toMatchObject({ pages: 1, page: 1, slice: [] });
  });
});
