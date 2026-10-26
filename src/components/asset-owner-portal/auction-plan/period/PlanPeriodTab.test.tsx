// Tab "Theo kỳ" — kiểm con số HIỆN TRÊN MÀN HÌNH, không chỉ kiểm hàm thuần.
//
// Mẫu ở đây là mẫu RÚT GỌN tự dựng (5 tài sản), KHÔNG phải bản chụp DB: chỉ hai
// dòng kết quả là số thật của Trạm demo UBND tỉnh Bắc Ninh (hồ sơ "Khu dân cư
// mới Vũ Ninh — lô LK1" đấu thành 15/06/2026 và "Đất ở xen kẹp tổ 4 Vũ Ninh"
// không thành 13/07/2026), còn tháng của ba tài sản còn lại được chọn để phủ cả
// ba loại kỳ. Bản đối chiếu SQL ↔ TS trên dữ liệu THẬT nằm ở
// `src/lib/auctionPlan/period.parity.test.ts` (68 cặp).
//
// `/chu-tai-san/*` nằm sau `ProtectedRoute` nên không kiểm được bằng trình
// duyệt; đây là bằng chứng ở tầng DOM thay cho ảnh chụp.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";
import { PlanPeriodTab } from "./PlanPeriodTab";

/* ─── Mẫu rút gọn: 5 tài sản, 2 kết quả LẤY TỪ Trạm demo ──────────────────── */

const OUTCOMES = [
  // KH26-001 "Khu dân cư mới Vũ Ninh — lô LK1": đấu thành 15/06/2026, thu đủ.
  {
    item_id: "i1",
    link: "posting",
    outcome: "sold",
    payment_status: "paid",
    auction_date: "2026-06-15",
    starting_price: 26880000000,
    winning_price: 31718400000,
    paid_amount: 31718400000,
    paid_at: "2026-07-05",
    round_no: 1,
  },
  // KH26-003 "Đất ở xen kẹp tổ 4 Vũ Ninh": không thành 13/07/2026.
  {
    item_id: "i3",
    link: "posting",
    outcome: "unsold",
    payment_status: null,
    auction_date: "2026-07-13",
    starting_price: 7255500000,
    winning_price: null,
    paid_amount: null,
    paid_at: null,
    round_no: 1,
  },
];

const BASELINE_ITEMS = [
  { id: "i1", planned_month: "2026-06-01", expected_start_value: 26880000000 },
  { id: "i2", planned_month: "2026-05-01", expected_start_value: 17280000000 },
  { id: "i3", planned_month: "2026-07-01", expected_start_value: 7255500000 },
  { id: "i4", planned_month: "2026-11-01", expected_start_value: 23100000000 },
  { id: "i5", planned_month: "2026-09-01", expected_start_value: 19840000000 },
];

vi.mock("@/hooks/useAuctionPlanProgress", () => ({
  usePlanItemOutcomes: () => ({ data: OUTCOMES, isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useAuctionPlanApproval", () => ({
  usePlanBaselines: () => ({
    data: [{ version: 1, payload: { items: BASELINE_ITEMS } }],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useOwnerTargets", () => ({
  useOwnerTargets: () => ({ targets: [] as never[], isLoading: false, isError: false }),
}));

const generate = vi.fn();
vi.mock("@/hooks/useAuctionPlanPeriod", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/hooks/useAuctionPlanPeriod")>();
  return { ...real, useGeneratePlanTargets: () => ({ mutate: generate, isPending: false }) };
});

const PLAN = {
  id: "c0bfd4d4",
  workspace_id: "d10ba07b",
  branch_id: "8e6d6935",
  plan_year: 2026,
  status: "approved",
} as AuctionPlan;

const ITEMS = [
  { id: "i1", item_code: "KH26-001", title: "Khu dân cư mới Vũ Ninh — lô LK1", planned_month: "2026-06-01", expected_start_value: 26880000000, exec_status: "active" },
  { id: "i2", item_code: "KH26-002", title: "Đất ở Kinh Bắc", planned_month: "2026-05-01", expected_start_value: 17280000000, exec_status: "active" },
  { id: "i3", item_code: "KH26-003", title: "Đất ở xen kẹp tổ 4 Vũ Ninh", planned_month: "2026-07-01", expected_start_value: 7255500000, exec_status: "active" },
  { id: "i4", item_code: "KH26-004", title: "Khu đấu giá Vũ Ninh — đợt 2", planned_month: "2026-11-01", expected_start_value: 23100000000, exec_status: "active" },
  { id: "i5", item_code: "KH26-005", title: "Đất ở Đáp Cầu", planned_month: "2026-09-01", expected_start_value: 19840000000, exec_status: "active" },
] as unknown as AuctionPlanItem[];

const renderTab = (periodKey: string) =>
  render(
    <MemoryRouter initialEntries={[`/chu-tai-san/ke-hoach/c0bfd4d4?tab=theo-ky&ky=${periodKey}`]}>
      <PlanPeriodTab plan={PLAN} items={ITEMS} isLoading={false} canCreateTarget />
    </MemoryRouter>,
  );

/* ─── Con số theo luật A5 (cùng luật với auction_plan_period_metrics) ─────── */

describe('tab "Theo kỳ" — con số hiện đúng trên màn hình', () => {
  it("tháng 6/2026: 1/1 đấu thành, đã thu 31.7 tỷ", () => {
    renderTab("2026-06");
    expect(screen.getByText("Kết quả tháng 6/2026")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText(/hoàn thành 100%/)).toBeInTheDocument();
    // offered_count = 1 · sold_count = 1 · tổng giá trúng 31,718,400,000₫
    expect(screen.getByText("Số tài sản đưa ra đấu giá")).toBeInTheDocument();
    expect(screen.getByText(/Theo kế hoạch kỳ này: 1/)).toBeInTheDocument();
  });

  it("quý II/2026: kế hoạch 2 tài sản, đấu thành 1 ⇒ 50%", () => {
    renderTab("2026-Q2");
    expect(screen.getByText("Kết quả quý II/2026")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText(/hoàn thành 50%/)).toBeInTheDocument();
  });

  it("năm 2026: kế hoạch 5 tài sản, đấu thành 1 ⇒ 20%", () => {
    renderTab("2026");
    expect(screen.getByText("Kết quả năm 2026")).toBeInTheDocument();
    expect(screen.getByText("1/5")).toBeInTheDocument();
    expect(screen.getByText(/hoàn thành 20%/)).toBeInTheDocument();
  });

  it("bảng tài sản của kỳ: tháng 7 có tài sản không thành", () => {
    renderTab("2026-07");
    expect(screen.getByText("Đất ở xen kẹp tổ 4 Vũ Ninh")).toBeInTheDocument();
    expect(screen.getByText(/Tài sản của tháng 7\/2026/)).toBeInTheDocument();
    // Không thành ⇒ không có giá trúng, cột thu tiền để trống (payment_status null).
    expect(screen.getByText("Không thành")).toBeInTheDocument();
  });

  it("kỳ không có gì: nêu rõ thay vì bảng trắng", () => {
    renderTab("2026-02");
    expect(screen.getByText("Không có tài sản nào thuộc tháng 2/2026.")).toBeInTheDocument();
  });

  it('nút "Tạo chỉ tiêu từ kế hoạch" hiện với kế hoạch ĐÃ DUYỆT', () => {
    renderTab("2026");
    expect(screen.getByRole("button", { name: /Tạo chỉ tiêu từ kế hoạch/ })).toBeInTheDocument();
  });

  it("biểu đồ có bảng số liệu ẩn cho trình đọc màn hình", () => {
    renderTab("2026");
    expect(screen.getByText("Kế hoạch so thực tế theo tháng năm 2026")).toBeInTheDocument();
  });
});
