// "Toàn tỉnh" — bằng chứng ở tầng DOM cho hai tiêu chí nghiệm thu của Phase 7:
//   ① cán bộ bị giới hạn chi nhánh KHÔNG mở được bảng toàn tỉnh;
//   ② xã chưa trình kế hoạch cho đợt đang mở hiện ở tầng L2, và biến mất khi trình.
//
// `/chu-tai-san/*` nằm sau `ProtectedRoute` nên không nghiệm thu được bằng trình
// duyệt (không có mật khẩu); đây là bằng chứng thay cho ảnh chụp. Cổng thật là
// SQL (`auction_plan_province_ok`) — test này chỉ chứng minh UI tôn trọng nó.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { provinceAttention, provinceSummary, type ProvinceRollupRow } from "@/lib/auctionPlan/province";
import OwnerPlanProvincePage from "./OwnerPlanProvincePage";

/** Hai xã của Trạm demo, kỳ "năm 2026" — số thật của `auction_plan_rollup`. */
const base: ProvinceRollupRow = {
  admin_unit_code: "09169",
  unit_name: "Phường Vũ Ninh",
  unit_level: "commune",
  shape: "branch",
  branch_id: "b1",
  child_workspace_id: null,
  in_cycle: true,
  cycle_id: "c-sup",
  cycle_kind: "supplement",
  cycle_status: "open",
  submit_deadline: "2026-11-16",
  cycle_plan_id: null,
  cycle_plan_status: null,
  assigned_revenue: 60_000_000_000,
  assigned_count: 8,
  plan_count: 1,
  plan_id: "plan-vn",
  plan_status: "approved",
  plan_statuses: ["approved"],
  has_submitted: true,
  is_returned: false,
  period_type: "year",
  period_start: "2026-01-01",
  period_end: "2026-12-31",
  planned_count: 5,
  planned_start_value: 94_355_500_000,
  offered_count: 2,
  sold_count: 1,
  actual_start_value: 34_135_500_000,
  winning_total: 31_718_400_000,
  collected: 31_718_400_000,
  recorded: 31_718_400_000,
  estimated: 0,
  awaiting: 0,
  done_pct: 20,
  late_count: 1,
  at_risk_count: 1,
  last_update: "2026-10-26T11:51:33Z",
};

const ROWS: ProvinceRollupRow[] = [
  base,
  {
    ...base,
    admin_unit_code: "07339",
    unit_name: "Xã Tân Yên",
    plan_id: "plan-ty",
    assigned_revenue: 30_000_000_000,
    planned_count: 4,
    planned_start_value: 39_860_000_000,
    winning_total: 9_912_000_000,
    collected: 9_912_000_000,
    recorded: 9_912_000_000,
    done_pct: 25,
  },
];

let provinceOk = true;
let rows: ProvinceRollupRow[] = ROWS;

vi.mock("@/hooks/useOwnerWorkspace", () => ({
  useOwnerWorkspace: () => ({ workspaceId: "w-province", isLoading: false }),
}));

vi.mock("@/hooks/useAuctionPlanApproval", () => ({
  usePlanCanApprove: () => ({ data: provinceOk }),
}));

vi.mock("@/hooks/useAuctionPlanProvince", () => ({
  useAuctionPlanProvinceOk: () => ({ data: provinceOk, isLoading: false }),
  useProvinceBoard: () => ({
    rows,
    summary: provinceSummary(rows),
    attention: provinceAttention(rows),
    today: "2026-10-26",
    isLoading: false,
    isError: false,
  }),
  useAllPlanCycles: () => ({ cycles: [] as never[], units: [] as never[], isLoading: false, isError: false }),
  useConsolidatedPlanItems: () => ({ rows: [] as never[], units: [] as never[], isLoading: false, isError: false }),
  useClosePlan: () => ({ mutate: vi.fn(), isPending: false }),
  usePlanCycleCandidates: () => ({ data: [] as never[] }),
  useOpenPlanCycle: () => ({ mutate: vi.fn(), isPending: false }),
}));

const renderPage = () =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={["/chu-tai-san/ke-hoach/toan-tinh?nam=2026&ky=2026"]}>
        <OwnerPlanProvincePage />
      </MemoryRouter>
    </TooltipProvider>,
  );

beforeEach(() => {
  provinceOk = true;
  rows = ROWS;
});

describe("OwnerPlanProvincePage", () => {
  it("cán bộ bị giới hạn chi nhánh thấy thông báo ngoài phạm vi, KHÔNG thấy bảng", () => {
    provinceOk = false;
    renderPage();
    expect(screen.getByText("Bảng này ngoài phạm vi của bạn.")).toBeInTheDocument();
    expect(screen.queryByText("Phường Vũ Ninh")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mở đợt lập kế hoạch/ })).not.toBeInTheDocument();
  });

  it("cấp tỉnh thấy câu trả lời L1 và bảng từng đơn vị", () => {
    renderPage();
    // "2/2" ở cả con số L1 và ô chỉ số L3 — cùng một nguồn, nên có hai lần là đúng.
    expect(screen.getAllByText("2/2")).toHaveLength(2);
    expect(screen.getByText(/9 tài sản theo kế hoạch năm 2026/)).toBeInTheDocument();
    // Tên xã có ở cả thẻ việc L2 và bảng L3.
    expect(screen.getAllByText("Phường Vũ Ninh").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Xã Tân Yên").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Xem kế hoạch" })).toHaveLength(2);
  });

  it("xã chưa trình kế hoạch cho đợt đang mở hiện ở tầng L2", () => {
    renderPage();
    expect(screen.getByText("Đơn vị chưa trình kế hoạch")).toBeInTheDocument();
    expect(screen.getAllByText(/Chưa lập kế hoạch cho đợt/)).toHaveLength(2);
  });

  it("xã rời khỏi tầng L2 ngay khi kế hoạch của đợt được trình", () => {
    rows = ROWS.map((r) =>
      r.admin_unit_code === "09169"
        ? {
            ...r,
            cycle_plan_id: "p-sup",
            cycle_plan_status: "submitted" as const,
            plan_count: 2,
            plan_statuses: ["approved" as const, "submitted" as const],
          }
        : r,
    );
    renderPage();
    expect(screen.getAllByText(/Chưa lập kế hoạch cho đợt/)).toHaveLength(1);
    expect(screen.getByText("Chờ cấp tỉnh xem xét")).toBeInTheDocument();
  });

  it("kỳ không có tài sản theo kế hoạch hiện '—' thay cho 0%", () => {
    rows = [{ ...base, planned_count: 0, planned_start_value: 0, done_pct: null }];
    renderPage();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });
});
