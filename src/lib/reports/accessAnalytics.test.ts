import { describe, it, expect, vi } from "vitest";

// Phòng khi type-import không được elide hoàn toàn (transactionReport → credits → supabase).
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { formatAccessReport, type RawAccessReport } from "./accessAnalytics";

const raw = (over: Partial<RawAccessReport> = {}): RawAccessReport => ({
  timeseries: [],
  topPages: [],
  byFeature: [],
  byDevice: [],
  byProvince: [],
  funnel: { visitors: 0, registrations: 0, activations: 0, spenders: 0 },
  kpis: { totalVisits: 0, totalPageViews: 0, uniqueUsers: 0, featureEvents: 0 },
  ...over,
});

const range = { from: new Date("2026-07-01T00:00:00"), to: new Date("2026-07-03T23:59:59") };

describe("formatAccessReport", () => {
  it("zero-fills the time axis and matches server buckets by day key", () => {
    const r = formatAccessReport(
      raw({ timeseries: [{ bucket: "2026-07-02T00:00:00Z", visits: 5, page_views: 12, unique_users: 3 }] }),
      range,
      "day",
    );
    expect(r.timeSeries).toHaveLength(3); // 01, 02, 03
    expect(r.timeSeries.map((b) => b.visits)).toEqual([0, 5, 0]);
    expect(r.timeSeries[1].pageViews).toBe(12);
  });

  it("computes funnel pctOfTop and pctOfPrev; first stage has null pctOfPrev", () => {
    const r = formatAccessReport(
      raw({ funnel: { visitors: 200, registrations: 50, activations: 20, spenders: 10 } }),
      range,
      "day",
    );
    expect(r.funnel.map((s) => s.value)).toEqual([200, 50, 20, 10]);
    expect(r.funnel[0].pctOfPrev).toBeNull();
    expect(r.funnel[0].pctOfTop).toBe(100);
    expect(r.funnel[1].pctOfTop).toBe(25); // 50/200
    expect(r.funnel[1].pctOfPrev).toBe(25); // 50/200
    expect(r.funnel[2].pctOfPrev).toBe(40); // 20/50
  });

  it("sorts provinces desc with 'Không rõ' last", () => {
    const r = formatAccessReport(
      raw({
        byProvince: [
          { province: "Không rõ", count: 999 },
          { province: "Hà Nội", count: 10 },
          { province: "TP. Hồ Chí Minh", count: 40 },
        ],
      }),
      range,
      "day",
    );
    expect(r.byProvince.map((p) => p.province)).toEqual(["TP. Hồ Chí Minh", "Hà Nội", "Không rõ"]);
  });

  it("labels devices and features in Vietnamese", () => {
    const r = formatAccessReport(
      raw({
        byDevice: [{ device_type: "mobile", count: 3 }, { device_type: "unknown", count: 1 }],
        byFeature: [{ feature_key: "open_paywall", count: 7, unique_users: 4 }],
      }),
      range,
      "day",
    );
    expect(r.byDevice[0].label).toBe("Điện thoại");
    expect(r.byDevice[1].label).toBe("Không rõ");
    expect(r.byFeature[0].label).toBe("Mở hộp thoại trả phí");
    expect(r.byFeature[0].uniqueUsers).toBe(4);
  });

  it("handles null raw safely (all zeros, still zero-filled axis)", () => {
    const r = formatAccessReport(null, range, "day");
    expect(r.timeSeries).toHaveLength(3);
    expect(r.kpis.totalVisits).toBe(0);
    expect(r.funnel).toHaveLength(4);
  });
});
