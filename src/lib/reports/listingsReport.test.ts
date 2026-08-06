import { describe, it, expect, vi } from "vitest";

// Phòng khi type-import không được elide hoàn toàn (transactionReport → credits → supabase).
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  formatListingsReport,
  parentOf,
  slugsForParent,
  startValueOf,
  type RawListingsReport,
} from "./listingsReport";

const raw = (over: Partial<RawListingsReport> = {}): RawListingsReport => ({
  kpis: {
    period: {
      listings: 0,
      value: 0,
      medianValue: 0,
      valuedCount: 0,
      orgs: 0,
      owners: 0,
      provinces: 0,
      views: 0,
    },
    total: { listings: 0, active: 0, pending: 0, draft: 0, value: 0 },
  },
  timeseries: [],
  byStatus: [],
  bySessionStatus: [],
  byCategory: [],
  byCategoryChild: [],
  byProvince: [],
  byPriceBucket: [],
  topOrgs: [],
  topOwners: [],
  coverage: {
    total: 0,
    withImage: 0,
    withValue: 0,
    withAuctionAt: 0,
    withOrg: 0,
    withOwner: 0,
    withProvince: 0,
    verified: 0,
    featured: 0,
  },
  ...over,
});

const range = { from: new Date("2026-07-01T00:00:00"), to: new Date("2026-07-03T23:59:59") };

describe("formatListingsReport", () => {
  it("trả về báo cáo rỗng khi chưa có dữ liệu", () => {
    const r = formatListingsReport(null, range, "day");
    expect(r.kpis.periodListings).toBe(0);
    expect(r.timeSeries).toHaveLength(0);
  });

  it("zero-fill trục thời gian và khớp bucket của server theo key ngày", () => {
    const r = formatListingsReport(
      raw({ timeseries: [{ bucket: "2026-07-02T00:00:00Z", listings: 4, value: 9_000_000_000 }] }),
      range,
      "day",
    );
    expect(r.timeSeries).toHaveLength(3); // 01, 02, 03
    expect(r.timeSeries.map((b) => b.listings)).toEqual([0, 4, 0]);
    expect(r.timeSeries[1].value).toBe(9_000_000_000);
  });

  it("ép numeric dạng string của Postgres về number", () => {
    const r = formatListingsReport(
      raw({
        // Supabase có thể trả numeric dưới dạng chuỗi
        kpis: {
          period: {
            listings: "12" as unknown as number,
            value: "1875574210541.00" as unknown as number,
            medianValue: 0,
            valuedCount: 0,
            orgs: 0,
            owners: 0,
            provinces: 0,
            views: 0,
          },
          total: { listings: 0, active: 0, pending: 0, draft: 0, value: 0 },
        },
      }),
      range,
      "day",
    );
    expect(r.kpis.periodListings).toBe(12);
    expect(r.kpis.periodValue).toBeCloseTo(1_875_574_210_541);
  });

  it("histogram giá luôn đủ 5 cột và đúng thứ tự, kể cả khi server thiếu bucket", () => {
    const r = formatListingsReport(
      raw({ byPriceBucket: [{ bucket: "5to20", sort: 3, listings: 29, value: 1 }] }),
      range,
      "day",
    );
    expect(r.byPriceBucket.map((b) => b.key)).toEqual(["lt1", "1to5", "5to20", "20to100", "gt100"]);
    expect(r.byPriceBucket.map((b) => b.listings)).toEqual([0, 0, 29, 0, 0]);
  });

  it('chỉ hiện cột "Chưa quy đổi" khi thực sự có tin không quy đổi được', () => {
    const r = formatListingsReport(
      raw({ byPriceBucket: [{ bucket: "unknown", sort: 6, listings: 3, value: 0 }] }),
      range,
      "day",
    );
    expect(r.byPriceBucket).toHaveLength(6);
    expect(r.byPriceBucket[5]).toMatchObject({ key: "unknown", label: "Chưa quy đổi", listings: 3 });
  });

  it('đẩy "Không rõ" xuống cuối bảng tỉnh', () => {
    const r = formatListingsReport(
      raw({
        byProvince: [
          { province: "Không rõ", listings: 99, value: 0 },
          { province: "Hà Nội", listings: 8, value: 0 },
          { province: "Đà Nẵng", listings: 12, value: 0 },
        ],
      }),
      range,
      "day",
    );
    expect(r.byProvince.map((p) => p.province)).toEqual(["Đà Nẵng", "Hà Nội", "Không rõ"]);
  });

  it("sắp trạng thái tin và trạng thái phiên theo vòng đời, không theo số lượng", () => {
    const r = formatListingsReport(
      raw({
        byStatus: [
          { status: "ACTIVE", listings: 35, value: 0 },
          { status: "DRAFT", listings: 5, value: 0 },
        ],
        bySessionStatus: [
          { session_status: "ended", listings: 38, value: 0 },
          { session_status: "registration_open", listings: 44, value: 0 },
        ],
      }),
      range,
      "day",
    );
    expect(r.byStatus.map((s) => s.key)).toEqual(["DRAFT", "ACTIVE"]);
    expect(r.byStatus[0].label).toBe("Nháp");
    expect(r.bySessionStatus.map((s) => s.key)).toEqual(["registration_open", "ended"]);
    expect(r.bySessionStatus[0].label).toBe("Đang bán hồ sơ");
  });

  it("tính % độ đầy đủ dữ liệu, không chia cho 0", () => {
    const empty = formatListingsReport(raw(), range, "day");
    expect(empty.coverage.every((c) => c.pct === 0)).toBe(true);

    const r = formatListingsReport(
      raw({
        coverage: {
          total: 82,
          withImage: 81,
          withValue: 82,
          withAuctionAt: 18,
          withOrg: 55,
          withOwner: 55,
          withProvince: 82,
          verified: 0,
          featured: 0,
        },
      }),
      range,
      "day",
    );
    const auction = r.coverage.find((c) => c.key === "withAuctionAt")!;
    expect(auction.count).toBe(18);
    expect(auction.pct).toBeCloseTo((18 / 82) * 100);
  });
});

describe("taxonomy hai thế hệ", () => {
  it("gom cả slug mới lẫn slug cũ về đúng nhóm cha", () => {
    expect(parentOf("can-ho")).toBe("bat-dong-san"); // thế hệ mới
    expect(parentOf("can-ho-chung-cu")).toBe("bat-dong-san"); // thế hệ cũ
    expect(parentOf("kho-xuong")).toBe("bat-dong-san"); // có thật trong DB
    expect(parentOf("dat-nen")).toBe("bat-dong-san"); // có thật trong DB
    expect(parentOf("o-to")).toBe("xe-co");
    expect(parentOf("bat-dong-san")).toBe("bat-dong-san"); // slug cha tự nó
  });

  it("slug lạ rơi vào khac", () => {
    expect(parentOf("slug-chua-tung-thay")).toBe("khac");
  });

  it("slugsForParent trả danh sách in cho nhóm thường, exclude cho khac", () => {
    const bds = slugsForParent("bat-dong-san");
    expect(bds.inList).toContain("bat-dong-san");
    expect(bds.inList).toContain("kho-xuong");
    expect(bds.excludeList).toBeUndefined();

    const khac = slugsForParent("khac");
    expect(khac.inList).toBeUndefined();
    expect(khac.excludeList).toContain("can-ho");
    expect(khac.excludeList).not.toContain("khac");
  });
});

describe("startValueOf", () => {
  it("TOTAL giữ nguyên giá", () => {
    expect(startValueOf(5_000_000_000, "TOTAL", 100)).toBe(5_000_000_000);
  });

  it("PER_SQM nhân với diện tích, diện tích 0 coi như 1", () => {
    expect(startValueOf(50_000_000, "PER_SQM", 120)).toBe(6_000_000_000);
    expect(startValueOf(50_000_000, "PER_SQM", 0)).toBe(50_000_000);
  });

  it("PER_MONTH bị loại — giá thuê không phải giá khởi điểm", () => {
    expect(startValueOf(20_000_000, "PER_MONTH", 100)).toBeNull();
  });

  it("giá thiếu hoặc <= 0 trả null", () => {
    expect(startValueOf(null, "TOTAL", 100)).toBeNull();
    expect(startValueOf(0, "TOTAL", 100)).toBeNull();
  });
});
