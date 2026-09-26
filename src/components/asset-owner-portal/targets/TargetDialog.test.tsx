import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { OwnerTarget } from "@/lib/ownerTargets";
import { periodStartOf } from "@/lib/ownerTargets";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { TargetDialog } from "./TargetDialog";

const saveMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("@/hooks/useOwnerTargets", () => ({
  useSaveOwnerTarget: () => ({ mutate: saveMutate, isPending: false }),
  useDeleteOwnerTarget: () => ({ mutate: deleteMutate, isPending: false }),
}));

// Kỳ tính theo ngày chạy test — không đóng cứng tháng.
const TODAY = todayIso();
const MONTH = periodStartOf("month", TODAY);
const QUARTER = periodStartOf("quarter", TODAY);

const target = (over: Partial<OwnerTarget> = {}): OwnerTarget => ({
  id: "t-month",
  workspaceId: "w1",
  branchId: null,
  periodType: "month",
  periodStart: MONTH,
  targetAmount: 20_000_000_000,
  targetCount: null,
  ...over,
});

const renderDialog = (targets: OwnerTarget[]) =>
  render(
    <TargetDialog
      open
      onOpenChange={vi.fn()}
      workspaceId="w1"
      targets={targets}
      branches={[{ id: "b1", label: "Chi nhánh Hà Nội", isActive: true, assetOwnerId: "ao1" }]}
      initial={{ periodType: "month", periodStart: MONTH, scope: "all" }}
    />,
  );

describe("TargetDialog", () => {
  beforeEach(() => {
    saveMutate.mockClear();
    deleteMutate.mockClear();
  });

  it("kỳ + phạm vi chưa có chỉ tiêu: 'Đặt chỉ tiêu', bắt buộc nhập ít nhất một chỉ tiêu", async () => {
    renderDialog([]);
    expect(screen.getByRole("heading", { name: "Đặt chỉ tiêu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu chỉ tiêu" }));
    expect(await screen.findByText("Nhập số tiền thu hồi hoặc số tài sản đấu thành")).toBeInTheDocument();
    expect(saveMutate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Số tài sản đấu thành/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu chỉ tiêu" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    expect(saveMutate.mock.calls[0][0]).toMatchObject({
      id: null,
      form: { periodType: "month", periodStart: MONTH, scope: "all", count: "12" },
    });
  });

  it("kỳ + phạm vi đã có chỉ tiêu: chuyển sang sửa, điền sẵn số, lưu theo id", async () => {
    renderDialog([target()]);
    expect(screen.getByRole("heading", { name: "Sửa chỉ tiêu" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Số tiền thu hồi/)).toHaveValue("20,000,000,000");
    fireEvent.click(screen.getByRole("button", { name: "Lưu chỉ tiêu" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    expect(saveMutate.mock.calls[0][0]).toMatchObject({ id: "t-month" });
  });

  it("đổi sang Quý nạp chỉ tiêu quý đã có", async () => {
    renderDialog([target(), target({ id: "t-q", periodType: "quarter", periodStart: QUARTER, targetAmount: null, targetCount: 30 })]);
    fireEvent.click(screen.getByRole("button", { name: "Quý" }));
    expect(screen.getByRole("heading", { name: "Sửa chỉ tiêu" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Số tài sản đấu thành/)).toHaveValue("30"));
    expect(screen.getByLabelText(/Số tiền thu hồi/)).toHaveValue("");
  });

  it("xoá phải bấm hai lần", () => {
    renderDialog([target()]);
    fireEvent.click(screen.getByRole("button", { name: "Xoá chỉ tiêu" }));
    expect(deleteMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Bấm lần nữa để xoá" }));
    expect(deleteMutate).toHaveBeenCalledWith("t-month", expect.anything());
  });
});
