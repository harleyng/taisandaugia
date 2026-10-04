import { describe, expect, it } from "vitest";
import {
  assetPriceRatioPct,
  funnelChannelLabel,
  funnelStages,
  isFunnelEmpty,
  mapMarketingFunnel,
  priceRatioPct,
  resolveFunnelPeriod,
  stageBarPct,
} from "./funnel";
import { ownerMarketingPerformanceHref } from "./routes";

// Dạng JSON của owner_mkt_funnel (migration 20261002150000) — lấy từ lần chạy thử trên DB.
const RAW = {
  ok: true,
  period: { from: "2026-09-01", to: "2026-10-31" },
  attribution_days: 30,
  totals: {
    assets: 1,
    links: 2,
    orders: 0,
    sent: 0,
    opened: 0,
    clicks: 3,
    visitors: 3,
    saves: 1,
    registrations: 1,
    participants: 3,
    outcomes: 1,
    sold: 1,
    sold_value: 28450000000,
    priced_sold_value: 28450000000,
    priced_starting_value: "28469978549.00",
  },
  unattributed: { saves: 0, registrations: 2 },
  by_channel: [
    { kind: "link", key: "zalo", items: 1, sent: 0, opened: 0, clicks: 2, visitors: 2, saves: 1, registrations: 1 },
    { kind: "platform", key: "mkt_banner_owner", items: 1, sent: 500, opened: 0, clicks: 12, visitors: 12, saves: 0, registrations: 0 },
    { kind: "link", key: null as string | null },
  ],
  by_source: [
    { key: "own_links", items: 2, clicks: 3, visitors: 3, saves: 1, registrations: 1 },
    { key: "hack", items: 1 },
  ],
  by_asset: [
    {
      listing_id: "9cd80e46-ee77-4717-9b00-621889fbae82",
      asset_code: "9CD80E46",
      title: "Nhà phố 449.6m² tại Đống Đa, Hà Nội",
      branch_name: "ACB – Chi nhánh Bình Dương",
      links: 2,
      orders: 0,
      clicks: 3,
      visitors: 3,
      saves: 1,
      saves_unattributed: 0,
      registrations: 1,
      registrations_unattributed: 2,
      participants: 3,
      outcome: "sold",
      outcome_date: "2026-09-13",
      price: 28450000000,
      starting_price: "28469978549.00",
    },
  ],
};

describe("mapMarketingFunnel", () => {
  it("đọc đủ khung và ép số từ chuỗi NUMERIC", () => {
    const f = mapMarketingFunnel(RAW)!;
    expect(f.period).toEqual({ from: "2026-09-01", to: "2026-10-31" });
    expect(f.totals.pricedStartingValue).toBe(28469978549);
    expect(f.unattributed).toEqual({ saves: 0, registrations: 2 });
    expect(f.byAsset[0]).toMatchObject({ assetCode: "9CD80E46", outcome: "sold", startingPrice: 28469978549 });
  });

  it("bỏ dòng kênh không có mã và nguồn lạ", () => {
    const f = mapMarketingFunnel(RAW)!;
    expect(f.byChannel.map((c) => c.key)).toEqual(["zalo", "mkt_banner_owner"]);
    expect(f.bySource.map((s) => s.key)).toEqual(["own_links"]);
  });

  it("báo cáo đã chia sẻ không có listing_id ⇒ null, không lỗi", () => {
    const shared = { ...RAW, by_asset: [{ ...RAW.by_asset[0], listing_id: undefined as string | undefined }] };
    expect(mapMarketingFunnel(shared)!.byAsset[0].assetId).toBeNull();
  });

  it("không có kỳ ⇒ null (báo cáo chốt trước Phase M5 không có phần này)", () => {
    expect(mapMarketingFunnel(undefined)).toBeNull();
    expect(mapMarketingFunnel({ totals: {} })).toBeNull();
  });
});

describe("funnelStages", () => {
  it("đúng thứ tự §B5", () => {
    const f = mapMarketingFunnel(RAW)!;
    expect(funnelStages(f.totals).map((s) => [s.label, s.value])).toEqual([
      ["Gửi", 0],
      ["Mở", 0],
      ["Bấm", 3],
      ["Xem tài sản", 3],
      ["Lưu", 1],
      ["Đăng ký tham gia", 1],
      ["Người tham gia phiên", 3],
      ["Kết quả", 1],
    ]);
  });
});

describe("tỷ lệ & thanh", () => {
  it("giá trúng / khởi điểm", () => {
    const f = mapMarketingFunnel(RAW)!;
    expect(priceRatioPct(f.totals)).toBe(100);
    expect(priceRatioPct({ pricedSoldValue: 0, pricedStartingValue: 0 })).toBeNull();
    expect(assetPriceRatioPct({ outcome: "sold", price: 1_200, startingPrice: 1_000 })).toBe(120);
    expect(assetPriceRatioPct({ outcome: "unsold", price: null, startingPrice: 1_000 })).toBeNull();
  });

  it("thanh tối thiểu 2% khi có số, 0 khi không", () => {
    expect(stageBarPct(0, 100)).toBe(0);
    expect(stageBarPct(1, 1000)).toBe(2);
    expect(stageBarPct(50, 100)).toBe(50);
    expect(stageBarPct(5, 0)).toBe(0);
  });

  it("kỳ trống", () => {
    const f = mapMarketingFunnel(RAW)!;
    expect(isFunnelEmpty(f)).toBe(false);
    expect(isFunnelEmpty({ ...f, totals: { ...f.totals, assets: 0 } })).toBe(true);
    const zero = { ...f.totals, clicks: 0, visitors: 0, saves: 0, registrations: 0, participants: 0, sold: 0 };
    expect(isFunnelEmpty({ totals: zero, unattributed: { saves: 0, registrations: 0 } })).toBe(true);
    expect(isFunnelEmpty({ totals: zero, unattributed: { saves: 0, registrations: 1 } })).toBe(false);
  });
});

describe("nhãn", () => {
  it("kênh riêng vs gói sàn", () => {
    expect(funnelChannelLabel({ kind: "link", key: "zalo" })).toBe("Zalo");
    expect(funnelChannelLabel({ kind: "platform", key: "mkt_banner_owner" })).toBe("Sàn · Banner trên sàn");
  });
});

describe("resolveFunnelPeriod", () => {
  it("30 ngày tính cả hôm nay", () => {
    expect(resolveFunnelPeriod("30-ngay", "2026-10-02")).toEqual({ from: "2026-09-03", to: "2026-10-02" });
  });
  it("tháng / quý / năm theo lịch — khớp kỳ của báo cáo định kỳ", () => {
    expect(resolveFunnelPeriod("thang-nay", "2026-10-02")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolveFunnelPeriod("thang-truoc", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(resolveFunnelPeriod("quy-nay", "2026-08-20")).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(resolveFunnelPeriod("nam-nay", "2028-03-01")).toEqual({ from: "2028-01-01", to: "2028-12-31" });
  });
});

describe("ownerMarketingPerformanceHref", () => {
  it("cả đơn vị hoặc một tài sản", () => {
    expect(ownerMarketingPerformanceHref()).toBe("/chu-tai-san/hieu-qua-quang-cao");
    expect(ownerMarketingPerformanceHref("abc")).toBe("/chu-tai-san/hieu-qua-quang-cao?tai-san=abc");
  });
});
