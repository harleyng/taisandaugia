import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { computeTargetProgress, type OwnerTarget, type RecoveryInput } from "@/lib/ownerTargets";
import { TargetProgressBlock } from "./TargetProgressBlock";

const dialogProps = vi.fn();

vi.mock("./TargetDialog", () => ({
  TargetDialog: (props: { open: boolean; initial: { scope: string; periodType: string } }): null => {
    dialogProps(props);
    return null;
  },
}));

const TODAY = "2026-09-16";

const target = (over: Partial<OwnerTarget> = {}): OwnerTarget => ({
  id: "t-month",
  workspaceId: "w1",
  branchId: null,
  periodType: "month",
  periodStart: "2026-09-01",
  targetAmount: 20_000_000_000,
  targetCount: null,
  ...over,
});

const inputs: RecoveryInput[] = [
  { day: "2026-09-05", branchId: "b1", price: 8_000_000_000, paymentStatus: "paid", paidAmount: 8_000_000_000 },
  { day: "2026-09-08", branchId: "b2", price: 4_000_000_000, paymentStatus: null, paidAmount: null },
  { day: "2026-09-10", branchId: "b1", price: 3_000_000_000, paymentStatus: "pending", paidAmount: null },
];

const progressOf = (targets: OwnerTarget[]) => targets.map((t) => computeTargetProgress(t, inputs, TODAY));

const BRANCHES = [
  { id: "b1", label: "Chi nhánh Hà Nội", isActive: true, assetOwnerId: "ao1" },
  { id: "b2", label: "Chi nhánh TP.HCM", isActive: true, assetOwnerId: "ao2" },
];

const renderBlock = (props: Partial<Parameters<typeof TargetProgressBlock>[0]> = {}) =>
  render(
    <MemoryRouter>
      <TooltipProvider>
        <TargetProgressBlock
          workspaceId="w1"
          targets={[]}
          progress={[]}
          branches={BRANCHES}
          preferredBranchIds={[]}
          canManage
          loading={false}
          {...props}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe("TargetProgressBlock", () => {
  beforeEach(() => dialogProps.mockClear());

  it("chưa có chỉ tiêu: Trưởng đơn vị thấy CTA 'Đặt chỉ tiêu' và mở được dialog", () => {
    renderBlock();
    expect(screen.getByText("Chưa đặt chỉ tiêu cho kỳ này.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đặt chỉ tiêu" }));
    expect(dialogProps).toHaveBeenLastCalledWith(expect.objectContaining({ open: true }));
  });

  it("chưa có chỉ tiêu: người không quản lý không thấy nút, không có dialog", () => {
    renderBlock({ canManage: false });
    expect(screen.getByText("Trưởng đơn vị chưa đặt chỉ tiêu.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đặt chỉ tiêu" })).not.toBeInTheDocument();
    expect(dialogProps).not.toHaveBeenCalled();
  });

  it("có chỉ tiêu: đã thu / chỉ tiêu, phần trăm, ngày còn lại, phần tách theo mức chắc chắn", () => {
    const targets = [target()];
    renderBlock({ targets, progress: progressOf(targets) });
    expect(screen.getByText("Đã thu · chỉ tiêu tháng 9/2026")).toBeInTheDocument();
    expect(screen.getByText("trên 20 tỷ chỉ tiêu · đạt 60%")).toBeInTheDocument();
    expect(screen.getByText("Còn 15 ngày")).toBeInTheDocument();
    expect(screen.getByText("Đã ghi thu 8 tỷ")).toBeInTheDocument();
    expect(screen.getByText(/Theo giá trúng 4 tỷ/)).toBeInTheDocument();
    expect(screen.getByText("Chờ thu 3 tỷ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa chỉ tiêu" })).toBeInTheDocument();
  });

  it("người xem thấy tiến độ nhưng không có nút sửa", () => {
    const targets = [target()];
    renderBlock({ targets, progress: progressOf(targets), canManage: false });
    expect(screen.getByText("trên 20 tỷ chỉ tiêu · đạt 60%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa chỉ tiêu" })).not.toBeInTheDocument();
  });

  it("chỉ tiêu chỉ có số tài sản: số tài sản thành con số chính", () => {
    const targets = [target({ targetAmount: null, targetCount: 4 })];
    renderBlock({ targets, progress: progressOf(targets) });
    expect(screen.getByText("Tài sản đấu thành · chỉ tiêu tháng 9/2026")).toBeInTheDocument();
    expect(screen.getByText("đạt 75%")).toBeInTheDocument();
  });

  it("Cán bộ bị giới hạn chi nhánh mở sẵn chỉ tiêu của chi nhánh mình", () => {
    const targets = [target(), target({ id: "t-b1", branchId: "b1", targetAmount: 10_000_000_000 })];
    renderBlock({ targets, progress: progressOf(targets), preferredBranchIds: ["b1"], canManage: false });
    // Chi nhánh b1: đã thu 8 tỷ / 10 tỷ.
    expect(screen.getByText("trên 10 tỷ chỉ tiêu · đạt 80%")).toBeInTheDocument();
  });
});
