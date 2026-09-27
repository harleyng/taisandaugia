import { describe, expect, it } from "vitest";
import { inOwnerSaleTab, ownerSaleActionOf, ownerSaleTabCounts } from "./ownerTabs";
import type { SaleContract } from "@/types/auction-sale-contract";

type Row = Pick<SaleContract, "status" | "seller_confirmed_at" | "paid_at" | "handover_seller_confirmed_at">;

const row = (over: Partial<Row> = {}): Row => ({
  status: "drafting",
  seller_confirmed_at: null,
  paid_at: null,
  handover_seller_confirmed_at: null,
  ...over,
});

const T = "2026-09-20T09:00:00.000Z";

describe("ownerSaleActionOf", () => {
  it("chờ bên bán xác nhận bản ký", () => {
    expect(ownerSaleActionOf(row({ status: "awaiting_confirmation" }))).toBe("confirm_signed");
    expect(ownerSaleActionOf(row({ status: "awaiting_confirmation", seller_confirmed_at: T }))).toBe("none");
  });

  it("chỉ đòi xác nhận bàn giao khi đã ký VÀ đã thu đủ", () => {
    expect(ownerSaleActionOf(row({ status: "signed" }))).toBe("none");
    expect(ownerSaleActionOf(row({ status: "signed", paid_at: T }))).toBe("confirm_handover");
    expect(
      ownerSaleActionOf(row({ status: "signed", paid_at: T, handover_seller_confirmed_at: T })),
    ).toBe("none");
  });
});

describe("ownerSaleTabCounts", () => {
  it("'Cần bạn xử lý' là tập con của 'Đang thực hiện'", () => {
    const rows = [
      row({ status: "awaiting_confirmation" }),
      row({ status: "drafting" }),
      row({ status: "completed" }),
      row({ status: "cancelled" }),
    ];
    expect(ownerSaleTabCounts(rows)).toEqual({ action: 1, active: 2, completed: 1, cancelled: 1 });
    expect(inOwnerSaleTab(rows[0], "active")).toBe(true);
  });
});
