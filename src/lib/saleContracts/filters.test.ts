import { describe, expect, it } from "vitest";
import type { SaleContract } from "@/types/auction-sale-contract";
import {
  ALL_SESSIONS, ALL_STAGES, EMPTY_SALE_FILTERS, filterSaleContracts,
  foldText, saleSearchText, saleStageCounts,
} from "./filters";

const c = (o: Partial<SaleContract> = {}): SaleContract =>
  ({
    id: o.id ?? "c1", code: "HDMB000001", contract_no: null, session_id: "s1",
    status: "drafting", paid_at: null, handed_over_at: null, sign_due_at: null,
    handover_due_at: null, handover_scheduled_at: null, signed_doc_path: null,
    draft_doc_path: null, org_signs: false, buyer_confirmed_at: null,
    seller_confirmed_at: null, org_confirmed_at: null,
    handover_buyer_confirmed_at: null, handover_seller_confirmed_at: null,
    asset_snapshot: { title: "Nhà phố Quận 5", session_code: "PDG000014" },
    buyer_party: { full_name: "Nguyễn Văn Mua" },
    ...o,
  }) as unknown as SaleContract;

describe("foldText", () => {
  it("bỏ dấu và đ/Đ", () => {
    expect(foldText("Bảo Tín Đấu giá")).toBe("bao tin dau gia");
  });
});

describe("saleSearchText", () => {
  it("gộp mã, tài sản, phiên và bên mua", () => {
    const s = saleSearchText(c({ contract_no: "01/2026/HĐMB" }));
    expect(s).toContain("hdmb000001");
    expect(s).toContain("nha pho quan 5");
    expect(s).toContain("pdg000014");
    expect(s).toContain("nguyen van mua");
  });
});

describe("filterSaleContracts", () => {
  const rows = [
    c({ id: "a", session_id: "s1", status: "drafting" }),
    c({ id: "b", session_id: "s2", status: "signed", asset_snapshot: { title: "Đất nền Đồng Nai" } }),
    c({ id: "d", session_id: "s1", status: "cancelled" }),
  ];

  it("mặc định giữ tất cả", () => {
    expect(filterSaleContracts(rows, EMPTY_SALE_FILTERS)).toHaveLength(3);
  });

  it("lọc theo phiên", () => {
    expect(filterSaleContracts(rows, { ...EMPTY_SALE_FILTERS, sessionId: "s1" }).map((r) => r.id)).toEqual(["a", "d"]);
  });

  it("lọc theo giai đoạn", () => {
    expect(filterSaleContracts(rows, { ...EMPTY_SALE_FILTERS, stage: "paying" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterSaleContracts(rows, { ...EMPTY_SALE_FILTERS, stage: "cancelled" }).map((r) => r.id)).toEqual(["d"]);
  });

  it("tìm không dấu", () => {
    expect(filterSaleContracts(rows, { ...EMPTY_SALE_FILTERS, q: "dong nai" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("chỉ quá hạn: hợp đồng chưa quá hạn bị loại", () => {
    const past = "2020-01-01T00:00:00Z";
    const list = [c({ id: "x", sign_due_at: past }), c({ id: "y", sign_due_at: null })];
    expect(filterSaleContracts(list, { ...EMPTY_SALE_FILTERS, overdueOnly: true }).map((r) => r.id)).toEqual(["x"]);
  });

  it("các bộ lọc cộng dồn (AND)", () => {
    const r = filterSaleContracts(rows, {
      sessionId: "s1", stage: "signing", overdueOnly: false, q: "nha pho",
    });
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("ALL_* là hằng dùng chung với Select nên không rơi vào chuỗi rỗng", () => {
    expect(ALL_SESSIONS).toBe("all");
    expect(ALL_STAGES).toBe("all");
  });
});

describe("saleStageCounts", () => {
  it("đếm đủ 5 giai đoạn, kể cả giai đoạn 0", () => {
    const counts = saleStageCounts([c({ status: "drafting" }), c({ id: "2", status: "cancelled" })]);
    expect(counts).toEqual({ signing: 1, paying: 0, handover: 0, completed: 0, cancelled: 1 });
  });
});
