import { describe, it, expect } from "vitest";
import type { OutcomeOverviewRow, OverviewSource } from "./ownerOutcomesOverview";
import {
  conflictView,
  ledgerMoney,
  pageWindow,
  priceVsStart,
  shortAddress,
  sourceTrail,
  toLedgerRows,
} from "./ownerOutcomesLedger";

const src = (over: Partial<OverviewSource>): OverviewSource => ({
  kind: "org_report",
  label: "self_reported",
  outcome: "sold",
  price: 9_150_000_000,
  date: "2026-03-21",
  orgName: "Cty ĐG Hợp danh Việt Nam",
  sessionCode: null,
  roundNo: null,
  refId: "r1",
  paymentStatus: null,
  fp: "org_report|r1|sold|9150000000",
  dismissed: false,
  inRound: true,
  disagrees: false,
  ...over,
});

const own = src({
  kind: "owner_report",
  price: 8_950_000_000,
  refId: "o1",
  roundNo: 1,
  orgName: null,
  fp: "owner_report|o1|sold|8950000000",
});

const row = (sources: OverviewSource[], over: Partial<OutcomeOverviewRow> = {}): OutcomeOverviewRow => ({
  rowKey: "l:l1",
  listingId: "l1",
  titleKey: null,
  ownOutcomeId: "o1",
  ownRoundNo: 1,
  roundsReported: 1,
  title: "Đất dự án 140,7 m²",
  category: null,
  branchId: "b1",
  orgName: null,
  startingPrice: 8_500_000_000,
  outcome: "sold",
  price: sources[0]?.price ?? null,
  date: sources[0]?.date ?? null,
  paymentStatus: null,
  paidAmount: null,
  bestKind: sources[0]?.kind ?? null,
  confidence: sources[0]?.label ?? null,
  hasConflict: true,
  sources,
  ...over,
});

describe("ledgerMoney", () => {
  it("keeps two decimals in tỷ and rounds millions", () => {
    expect(ledgerMoney(28_450_000_000)).toBe("28.45 tỷ");
    expect(ledgerMoney(52_000_000_000)).toBe("52 tỷ");
    expect(ledgerMoney(1_234_560_000_000)).toBe("1,234.56 tỷ");
    expect(ledgerMoney(865_000_000)).toBe("865 tr");
    expect(ledgerMoney(999_600_000)).toBe("1 tỷ");
    expect(ledgerMoney(500_000)).toBe("500,000 ₫");
    expect(ledgerMoney(null)).toBe("—");
  });
});

describe("priceVsStart", () => {
  it("compares the winning price with the starting price", () => {
    expect(priceVsStart(52_000_000_000, 48_500_000_000)).toBe(7);
    expect(priceVsStart(10_000, 10_000)).toBe(0);
    expect(priceVsStart(9_000, 10_000)).toBe(-10);
    expect(priceVsStart(9_000, null)).toBeNull();
    expect(priceVsStart(null, 10_000)).toBeNull();
  });
});

describe("conflictView", () => {
  it("puts our number next to the organisation's and offers both choices", () => {
    const v = conflictView(row([src({}), { ...own, disagrees: true }]));
    expect(v.left?.kind).toBe("owner_report");
    expect(v.right?.kind).toBe("org_report");
    expect(v.gapPct).toBe(2.2);
    expect(v.actions).toEqual([
      { choice: "use_source", label: "Dùng số tổ chức ĐG", sourceFp: "org_report|r1|sold|9150000000" },
      { choice: "keep_mine", label: "Giữ số của tôi" },
    ]);
  });

  it("only lets the platform's number be adopted when the platform result is in use", () => {
    const v = conflictView(
      row([
        src({ kind: "platform", label: "platform", price: 28_450_000_000, refId: "i1", fp: "platform|i1|sold|28450000000" }),
        { ...own, disagrees: true },
        src({ disagrees: true }),
      ]),
    );
    expect(v.right?.kind).toBe("platform");
    expect(v.actions.map((a) => a.label)).toEqual(["Dùng số của sàn"]);
  });

  it("lets the unit adopt either number when it has not reported this round", () => {
    const v = conflictView(
      row(
        [
          src({}),
          src({ kind: "crawled", label: "estimated", price: 9_900_000_000, refId: "l1", fp: "crawled|l1|sold|9900000000", disagrees: true }),
        ],
        { ownOutcomeId: null, ownRoundNo: null },
      ),
    );
    expect(v.left?.kind).toBe("org_report");
    expect(v.right?.kind).toBe("crawled");
    expect(v.actions.map((a) => a.label)).toEqual(["Dùng số tổ chức ĐG", "Dùng số ước tính"]);
  });

  it("ignores dismissed or earlier-round sources and has no gap when the results differ", () => {
    const dismissed = conflictView(row([{ ...own }, src({ dismissed: true, disagrees: true })]));
    expect(dismissed.right).toBeNull();
    expect(dismissed.actions.map((a) => a.label)).toEqual(["Giữ số của tôi"]);

    const differ = conflictView(row([src({ outcome: "unsold", price: null }), { ...own, disagrees: true }]));
    expect(differ.gapPct).toBeNull();
    expect(differ.right?.outcome).toBe("unsold");
  });
});

describe("sourceTrail", () => {
  it("tells the platform story including the sale contract", () => {
    const steps = sourceTrail(
      row([src({ kind: "platform", label: "platform", sessionCode: "PDG000014", contractStatus: "signed", contractCode: "HD-01" })], {
        hasConflict: false,
        confidence: "platform",
      }),
    );
    expect(steps.map((s) => s.title)).toEqual(["Sàn ghi nhận kết quả phiên", "Hợp đồng mua bán đã ký"]);
    expect(steps[0].detail).toBe("Tự động · 21/03/2026 · PDG000014 · 9.15 tỷ");
  });

  it("ends with the confidence conclusion or the conflict", () => {
    const self = sourceTrail(row([{ ...own }], { hasConflict: false, confidence: "self_reported" }));
    expect(self.map((s) => s.title)).toEqual(["Bạn khai kết quả", "Chưa có nguồn thứ hai"]);
    expect(self[0].detail).toBe("21/03/2026 · Lượt 1 · 8.95 tỷ");

    const conflict = sourceTrail(row([src({}), { ...own, disagrees: true }]));
    expect(conflict[0].detail).toContain("đang dùng");
    expect(conflict[1].detail).toContain("lệch với số đang dùng");
    expect(conflict.at(-1)?.title).toBe("Các nguồn đang nói khác nhau");
  });
});

describe("toLedgerRows", () => {
  it("adds address, organisation and round from the listing; off-platform rows keep their own round", () => {
    const listings = new Map([["l1", { addressLine: "Tân Phú, Quận 7", roundCount: 2, auctionOrgName: "Cty ĐG Bảo Tín" }]]);
    const [onPlatform, offPlatform] = toLedgerRows(
      [
        row([src({})], { ownRoundNo: null }),
        row([{ ...own }], { rowKey: "t:x", listingId: null, titleKey: "x", ownRoundNo: 3, orgName: "Cty ĐG Miền Nam" }),
      ],
      listings,
    );
    expect(onPlatform).toMatchObject({ address: "Tân Phú, Quận 7", round: 2, orgName: "Cty ĐG Bảo Tín" });
    expect(offPlatform).toMatchObject({ address: null, round: 3, orgName: "Cty ĐG Miền Nam" });
  });
});

describe("shortAddress", () => {
  it("prefers ward and district", () => {
    expect(shortAddress({ street: "45 Lê Văn Lương", ward: "Phước Kiển", district: "Nhà Bè", province: "TP.HCM" })).toBe(
      "Phước Kiển, Nhà Bè",
    );
    expect(shortAddress({ street: "Bãi xe Tân Kiên", province: "TP.HCM" })).toBe("Bãi xe Tân Kiên, TP.HCM");
    expect(shortAddress(null)).toBe("");
  });
});

describe("pageWindow", () => {
  it("shows every page up to seven, otherwise a window with gaps", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 16, 17, 18, 19, 20]);
  });
});
