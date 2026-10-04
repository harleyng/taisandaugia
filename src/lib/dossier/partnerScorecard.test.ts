import { describe, expect, it } from "vitest";
import {
  NOT_ENOUGH_DATA,
  PARTNER_METRICS,
  assetDeviation,
  hasEnoughData,
  mapPartnerScore,
  metricText,
  partnersOfKind,
  type PartnerAsset,
} from "./partnerScorecard";

const row = (over: Record<string, unknown> = {}) => ({
  kind: "appraisal",
  partner_key: "name:cong ty tham dinh dat viet",
  partner_org_id: null as string | null,
  partner_name: "Công ty Thẩm định Đất Việt",
  assets: 3,
  assets_with_outcome: 3,
  sold_assets: 3,
  median_deviation: "0.2000",
  unsold_2plus_rate: "0.3333",
  legal_issue_assets: 1,
  success_rate: "1.0000",
  avg_rounds_to_sell: "1.67",
  avg_participants: "3.67",
  asset_list: [
    {
      posting_id: "p1",
      code: "HS-0001",
      title: "Nhà phố",
      outcome: "sold",
      rounds: 1,
      sold_price: 1500,
      appraised_value: 2000,
      last_date: "2026-07-05",
      legal_issue: false,
    },
    { code: "thiếu posting_id" },
  ],
  ...over,
});

describe("mapPartnerScore", () => {
  it("thu hẹp số dạng chuỗi (numeric) và bỏ tài sản thiếu id", () => {
    const p = mapPartnerScore(row())!;
    expect(p.medianDeviation).toBe(0.2);
    expect(p.avgRoundsToSell).toBe(1.67);
    expect(p.assetList).toHaveLength(1);
    expect(p.assetList[0].outcome).toBe("sold");
  });

  it("bỏ dòng loại lạ hoặc thiếu khoá", () => {
    expect(mapPartnerScore(row({ kind: "valuation" }))).toBeNull();
    expect(mapPartnerScore(row({ partner_key: null }))).toBeNull();
  });

  it("outcome lạ ⇒ null (chưa có kết quả)", () => {
    const p = mapPartnerScore(row({ asset_list: [{ posting_id: "p1", outcome: "lost" }] }))!;
    expect(p.assetList[0].outcome).toBeNull();
  });
});

describe("ngưỡng ≥ 3 tài sản có kết quả", () => {
  const m = PARTNER_METRICS.appraisal[0];

  it("đủ 3 ⇒ hiện chỉ số", () => {
    const p = mapPartnerScore(row())!;
    expect(hasEnoughData(p)).toBe(true);
    expect(metricText(p, m)).toBe("20%");
  });

  it("2 kết quả ⇒ Chưa đủ dữ liệu, kể cả khi server đã tính được số", () => {
    const p = mapPartnerScore(row({ assets_with_outcome: 2 }))!;
    expect(hasEnoughData(p)).toBe(false);
    expect(metricText(p, m)).toBe(NOT_ENOUGH_DATA);
  });

  it("chỉ số rỗng nhưng đủ ngưỡng ⇒ gạch ngang", () => {
    const p = mapPartnerScore(row({ median_deviation: null }))!;
    expect(metricText(p, m)).toBe("—");
  });

  it("pháp lý ghi số tài sản vướng / có kết quả", () => {
    const p = mapPartnerScore(row({ kind: "legal" }))!;
    expect(metricText(p, PARTNER_METRICS.legal[0])).toBe("1 / 3");
  });

  it("giám định đếm kết luận trên hồ sơ, ngưỡng theo số hồ sơ (không cần kết quả phiên)", () => {
    const list = [
      { posting_id: "p1", auth_verdict: "authentic" },
      { posting_id: "p2", auth_verdict: "authentic" },
      { posting_id: "p3", auth_verdict: "suspected_fake" },
    ];
    const p = mapPartnerScore(row({ kind: "authentication", assets: 3, assets_with_outcome: 0, asset_list: list }))!;
    expect(p.authenticAssets).toBe(2);
    expect(p.flaggedAssets).toBe(1);
    expect(metricText(p, PARTNER_METRICS.authentication[0])).toBe("2 / 3");
  });
});

describe("assetDeviation", () => {
  const a = (over: Partial<PartnerAsset>): PartnerAsset => ({
    postingId: "p",
    code: null,
    title: "t",
    outcome: "sold",
    rounds: 1,
    soldPrice: 1100,
    appraisedValue: 1000,
    lastDate: null,
    legalIssue: false,
    authVerdict: null,
    ...over,
  });

  it("có dấu theo chiều lệch", () => {
    expect(assetDeviation(a({}))).toBe("+10%");
    expect(assetDeviation(a({ soldPrice: 750 }))).toBe("−25%");
    expect(assetDeviation(a({ soldPrice: 1000 }))).toBe("0%");
  });

  it("chưa bán hoặc thiếu giá thẩm định ⇒ null", () => {
    expect(assetDeviation(a({ outcome: "unsold" }))).toBeNull();
    expect(assetDeviation(a({ appraisedValue: null }))).toBeNull();
    expect(assetDeviation(a({ appraisedValue: 0 }))).toBeNull();
  });
});

it("partnersOfKind lọc theo loại", () => {
  const rows = [mapPartnerScore(row())!, mapPartnerScore(row({ kind: "auction", partner_key: "org:x" }))!];
  expect(partnersOfKind(rows, "auction").map((r) => r.key)).toEqual(["org:x"]);
});
