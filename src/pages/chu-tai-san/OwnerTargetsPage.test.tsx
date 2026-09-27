import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  computeTargetProgress,
  groupTargetsByStatus,
  ownerTargetOf,
  type OwnerTarget,
  type TargetInput,
  type TargetPeriodType,
} from "@/lib/ownerTargets";
import OwnerTargetsPage from "./OwnerTargetsPage";

const TODAY = "2026-09-16";

vi.mock("@/hooks/useOwnerWorkspace", () => ({
  useOwnerWorkspace: () => ({ isLoading: false }),
}));

/** `amount` = tiêu chí tiền thu hồi (mặc định 20 tỷ), `count` = thêm tiêu chí tài sản đấu thành. */
const target = (
  over: Partial<Pick<OwnerTarget, "id" | "branchId" | "periodStart" | "name">> & {
    periodType?: TargetPeriodType;
    amount?: number | null;
    count?: number;
  } = {},
): OwnerTarget => {
  const { amount = 20_000_000_000, count, ...rest } = over;
  return ownerTargetOf({
    id: "t-month",
    workspaceId: "w1",
    branchId: null,
    periodType: "month",
    periodStart: "2026-09-01",
    name: null,
    criteria: [
      ...(amount !== null ? [{ metric: "recovered_amount" as const, goal: amount }] : []),
      ...(count !== undefined ? [{ metric: "sold_count" as const, goal: count }] : []),
    ],
    ...rest,
  });
};

const TARGETS = [
  target({ count: 1 }),
  target({ id: "t-b1", branchId: "b1", amount: 10_000_000_000, name: "Nợ xấu Hà Nội" }),
  target({ id: "t-q", periodType: "quarter", periodStart: "2026-07-01", amount: 60_000_000_000 }),
  target({ id: "t-next", periodStart: "2026-10-01", amount: null, count: 5 }),
  target({ id: "t-old", periodStart: "2026-08-01", amount: 5_000_000_000 }),
  target({ id: "t-miss", periodStart: "2026-07-01", amount: 10_000_000_000 }),
];
const INPUTS: TargetInput[] = [
  { key: "a", outcome: "sold", day: "2026-08-10", branchId: "b1", price: 6_000_000_000, paymentStatus: "paid", paidAmount: 6_000_000_000 },
  { key: "b", outcome: "sold", day: "2026-09-05", branchId: "b1", price: 8_000_000_000, paymentStatus: "paid", paidAmount: 8_000_000_000 },
];
const BRANCHES = [{ id: "b1", label: "Chi nhánh Hà Nội", isActive: true, assetOwnerId: "ao1" }];

let board: Record<string, unknown>;
vi.mock("@/hooks/useOwnerTargets", () => ({
  useOwnerTargetsBoard: () => board,
}));

const setBoard = (over: Record<string, unknown> = {}) => {
  const targets = (over.targets as OwnerTarget[] | undefined) ?? TARGETS;
  board = {
    workspaceId: "w1",
    targets,
    groups: groupTargetsByStatus(
      targets.map((t) => computeTargetProgress(t, INPUTS, TODAY)),
      TODAY,
    ),
    branches: BRANCHES,
    preferredBranchIds: [],
    canManage: true,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    today: TODAY,
    ...over,
  };
};

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname + search}</output>;
}

const renderPage = (url = "/chu-tai-san/chi-tieu") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <TooltipProvider>
        <OwnerTargetsPage />
      </TooltipProvider>
    </MemoryRouter>,
  );

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const group = (name: string) => screen.getByRole("region", { name });
const location = () => screen.getByTestId("location").textContent;

describe("OwnerTargetsPage", () => {
  beforeEach(() => setBoard());

  it("ba tab kèm số; 'Đang thực hiện' chia kỳ đang diễn ra và sắp tới", () => {
    renderPage();
    expect(tab(/Đang thực hiện\s*4/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/Đã hoàn thành\s*1/)).toBeInTheDocument();
    expect(tab(/Không hoàn thành\s*1/)).toBeInTheDocument();

    const running = group("Kỳ đang diễn ra");
    expect(within(running).getByText("Kỳ đang diễn ra · 3")).toBeInTheDocument();
    expect(within(running).getByText("Tháng 9/2026 · Toàn đơn vị")).toBeInTheDocument();
    expect(within(running).getByText("Nợ xấu Hà Nội")).toBeInTheDocument();
    expect(within(group("Sắp tới")).getByText("Tháng 10/2026 · Toàn đơn vị")).toBeInTheDocument();
    expect(screen.queryByText("Tháng 8/2026 · Toàn đơn vị")).not.toBeInTheDocument();
  });

  it("thẻ-dòng: khoảng ngày, số tiêu chí đạt, tiến độ chung có vạch thời gian; bấm mở chi tiết", () => {
    renderPage();
    // Tháng 9 cả đơn vị: tiền 8/20 tỷ = 40%, đấu thành 1/1 = 100% ⇒ trung bình 70%.
    const row = screen.getByRole("link", { name: /^Tháng 9\/2026 · Toàn đơn vị/ });
    expect(row).toHaveAttribute("href", "/chu-tai-san/chi-tieu/t-month");
    expect(within(row).getByText("01/09/2026 – 30/09/2026")).toBeInTheDocument();
    expect(within(row).getByText("70%")).toBeInTheDocument();
    expect(within(row).getByText("1/2")).toBeInTheDocument();
    expect(within(row).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
    expect(within(row).getByTitle("Thời gian đã qua 50%")).toBeInTheDocument();

    // Tên đặt tay: dòng phụ ghi kỳ; phạm vi hiện ở cột riêng.
    const named = screen.getByRole("link", { name: /Nợ xấu Hà Nội/ });
    expect(within(named).getByText(/Tháng 9\/2026 ·/)).toBeInTheDocument();
    expect(within(named).getAllByText("Chi nhánh Hà Nội").length).toBeGreaterThan(0);
  });

  it("kỳ sắp tới: chưa có thanh tiến độ, chỉ số tiêu chí đã đặt", () => {
    renderPage();
    const next = screen.getByRole("link", { name: /Tháng 10\/2026 · Toàn đơn vị/ });
    expect(within(next).getByText("Chưa bắt đầu · 1 tiêu chí đã đặt")).toBeInTheDocument();
    expect(within(next).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("tab đã chốt: đạt vào 'Đã hoàn thành', trượt vào 'Không hoàn thành'; tab ghi lên URL", () => {
    renderPage();
    fireEvent.mouseDown(tab(/Đã hoàn thành/));
    expect(location()).toBe("/chu-tai-san/chi-tieu?tab=completed");
    const done = screen.getByRole("link", { name: /Tháng 8\/2026 · Toàn đơn vị/ });
    // 6/5 tỷ = 120% ⇒ tiến độ chung tối đa 100%.
    expect(within(done).getByText("100%")).toBeInTheDocument();
    expect(screen.queryByText("Kỳ đang diễn ra · 3")).not.toBeInTheDocument();

    fireEvent.mouseDown(tab(/Không hoàn thành/));
    const missed = screen.getByRole("link", { name: /Tháng 7\/2026 · Toàn đơn vị/ });
    expect(within(missed).getByText("0%")).toBeInTheDocument();
    expect(within(missed).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("lọc từ URL: phạm vi chi nhánh + loại kỳ; số trên tab theo bộ lọc; lọc rỗng ⇒ thẻ trống", () => {
    renderPage("/chu-tai-san/chi-tieu?scope=b1");
    expect(tab(/Đang thực hiện\s*1/)).toBeInTheDocument();
    expect(screen.getByText("Nợ xấu Hà Nội")).toBeInTheDocument();
    expect(screen.queryByText("Tháng 9/2026 · Toàn đơn vị")).not.toBeInTheDocument();
  });

  it("lọc loại kỳ không khớp ⇒ thẻ 'Không có chỉ tiêu nào'", () => {
    renderPage("/chu-tai-san/chi-tieu?ky=year");
    expect(tab(/Đang thực hiện\s*0/)).toBeInTheDocument();
    expect(screen.getByText("Không có chỉ tiêu nào")).toBeInTheDocument();
    expect(screen.getByText("Thử đổi bộ lọc phạm vi hoặc loại kỳ.")).toBeInTheDocument();
  });

  it("'Đặt chỉ tiêu' mở trang form", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Đặt chỉ tiêu" }));
    expect(location()).toBe("/chu-tai-san/chi-tieu/moi");
  });

  it("người không phải Trưởng đơn vị: chỉ xem, không nút đặt", () => {
    setBoard({ canManage: false });
    renderPage();
    expect(screen.getByText("Chỉ Trưởng đơn vị đặt và sửa chỉ tiêu.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đặt chỉ tiêu" })).not.toBeInTheDocument();
  });

  it("chưa có chỉ tiêu nào: một trạng thái trống duy nhất, không tab", () => {
    setBoard({ targets: [] });
    renderPage();
    expect(screen.getByText("Chưa có chỉ tiêu nào.")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
