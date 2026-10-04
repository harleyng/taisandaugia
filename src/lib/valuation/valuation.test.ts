import { describe, expect, it } from "vitest";
import { summarizeValuations, tdgStepIndex } from "./status";
import { defaultValidUntil, ownerValuationPath, valuationCheckoutPath, valuationCertStoragePath } from "./paths";
import type { ValuationOrder } from "@/types/valuation";

const row = (id: string, status: string, completed_at: string | null = null) =>
  ({ id, status, completed_at }) as unknown as ValuationOrder;

describe("summarizeValuations", () => {
  it("tách đơn đang chạy, kết quả hiện hành và lịch sử (mới nhất trước)", () => {
    const s = summarizeValuations([
      row("a", "superseded", "2026-01-01"),
      row("b", "completed", "2026-05-01"),
      row("c", "paid"),
      row("d", "cancelled"),
    ]);
    expect(s.active?.id).toBe("c");
    expect(s.current?.id).toBe("b");
    expect(s.history.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("không có đơn ⇒ rỗng", () => {
    expect(summarizeValuations([])).toEqual({ active: null, current: null, history: [] });
  });
});

describe("đường dẫn & hiệu lực", () => {
  it("tab thẩm định giá + checkout quay về tab", () => {
    expect(ownerValuationPath("p1")).toMatch(/\/p1\?tab=tham-dinh$/);
    const url = new URL(valuationCheckoutPath("o1", "p1"), "https://x.vn");
    expect(url.searchParams.get("tdg_order")).toBe("o1");
    expect(url.searchParams.get("return")).toMatch(/tab=tham-dinh/);
  });

  it("chứng thư nằm trong {posting}/{order}/ (server kiểm lại)", () => {
    expect(valuationCertStoragePath("p1", "o1", "Chứng thư.pdf")).toMatch(/^p1\/o1\/\d+-Chung-thu\.pdf$/);
  });

  it("hiệu lực mặc định +6 tháng", () => {
    expect(defaultValidUntil("2026-10-04")).toBe("2027-04-04");
    expect(defaultValidUntil("2026-03-15")).toBe("2026-09-15");
  });

  it("thứ tự bước", () => {
    expect(tdgStepIndex("in_review")).toBe(3);
    expect(tdgStepIndex("cancelled")).toBe(-1);
  });
});
