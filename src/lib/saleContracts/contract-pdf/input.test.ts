import { describe, expect, it } from "vitest";
import type { SaleContract, SaleContractDetail } from "@/types/auction-sale-contract";
import { buildSalePdfInput, saleDraftFileName } from "./input";

const contract = (o: Partial<SaleContract> = {}): SaleContract =>
  ({
    id: "c1", code: "HDMB000001", contract_no: null,
    price: 12_700_000_000, deposit_credit: 4_590_000_000,
    status: "drafting", seller_kind: "owner_user", payee_side: "org",
    payee_bank_info: null, org_signs: false, notarization_required: false,
    handover_due_at: null,
    buyer_party: { full_name: "A" }, seller_party: { full_name: "B" },
    org_party: { name: "C" }, asset_snapshot: { title: "T" },
    ...o,
  }) as unknown as SaleContract;

const detail = (o: Partial<SaleContract> = {}, installments: unknown[] = []) =>
  ({ contract: contract(o), installments }) as unknown as Pick<
    SaleContractDetail,
    "contract" | "installments"
  >;

describe("buildSalePdfInput", () => {
  it("tính `payable` MỘT chỗ để renderer không lặp công thức", () => {
    expect(buildSalePdfInput(detail()).payable).toBe(8_110_000_000);
  });

  it("sắp kỳ theo seq, không theo thứ tự mảng", () => {
    const r = buildSalePdfInput(
      detail({}, [
        { seq: 2, label: "Đợt 2", due_at: null, amount: 1 },
        { seq: 1, label: "Đợt 1", due_at: null, amount: 2 },
      ]),
    );
    expect(r.installments.map((i) => i.seq)).toEqual([1, 2]);
  });

  it("ép tiền về số nguyên đồng kể cả khi Postgres trả chuỗi", () => {
    const r = buildSalePdfInput(
      detail({ price: "12700000000" as unknown as number }, [
        { seq: 1, label: null, due_at: null, amount: "8110000000" },
      ]),
    );
    expect(r.price).toBe(12_700_000_000);
    expect(r.installments[0].amount).toBe(8_110_000_000);
  });

  it("đánh dấu bên bán danh bạ để renderer đổi khối các bên", () => {
    expect(buildSalePdfInput(detail({ seller_kind: "org_on_behalf" })).sellerIsRegistry).toBe(true);
    expect(buildSalePdfInput(detail()).sellerIsRegistry).toBe(false);
  });

  it("TỪ CHỐI dựng dự thảo cho hợp đồng đã huỷ", () => {
    expect(() => buildSalePdfInput(detail({ status: "cancelled" }))).toThrow(/đã huỷ/);
  });

  it("thời điểm tạo tiêm được để test tất định", () => {
    const now = new Date("2026-01-02T03:04:05Z");
    expect(buildSalePdfInput(detail(), { now }).generatedAt).toBe(now);
  });
});

describe("saleDraftFileName — tên tệp phải qua được regex của server", () => {
  it("gắn mã hợp đồng", () => {
    expect(saleDraftFileName({ code: "HDMB000001" })).toBe("Du-thao-HDMB_HDMB000001.pdf");
  });

  it("chưa có mã vẫn ra tên hợp lệ", () => {
    expect(saleDraftFileName({ code: null })).toBe("Du-thao-HDMB_hop-dong.pdf");
  });

  it("chỉ chứa ký tự server chấp nhận", () => {
    expect(/^[A-Za-z0-9._-]+\.pdf$/.test(saleDraftFileName({ code: "HDMB000001" }))).toBe(true);
  });
});
