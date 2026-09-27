import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ownerTargetOf, type OwnerTarget, type TargetCriterion, type TargetInput } from "@/lib/ownerTargets";
import OwnerTargetFormPage from "./OwnerTargetFormPage";

const TODAY = "2026-09-16";

const saveMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("@/hooks/useOwnerWorkspace", () => ({
  useOwnerWorkspace: () => ({ isLoading: false }),
}));

let editor: Record<string, unknown>;
vi.mock("@/hooks/useOwnerTargets", () => ({
  useOwnerTargetEditor: (id: string | undefined) => ({
    ...editor,
    target: id ? (editor.targets as OwnerTarget[]).find((t) => t.id === id) ?? null : null,
  }),
  useSaveOwnerTarget: () => ({ mutate: saveMutate, isPending: false }),
  useDeleteOwnerTarget: () => ({ mutate: deleteMutate, isPending: false }),
}));

const BRANCHES = [{ id: "b1", label: "Chi nhánh Hà Nội", isActive: true, assetOwnerId: "ao1" }];

const target = (
  over: Partial<Pick<OwnerTarget, "id" | "branchId" | "periodType" | "periodStart" | "name">> & { criteria?: TargetCriterion[] } = {},
): OwnerTarget =>
  ownerTargetOf({
    id: "t-month",
    workspaceId: "w1",
    branchId: null,
    periodType: "month",
    periodStart: "2026-09-01",
    name: null,
    criteria: [{ metric: "recovered_amount", goal: 20_000_000_000 }],
    ...over,
  });

const INPUTS: TargetInput[] = [
  { key: "a", outcome: "sold", day: "2026-08-10", branchId: null, price: 6_000_000_000, paymentStatus: "paid", paidAmount: null },
];

const setEditor = (over: Record<string, unknown> = {}) => {
  editor = {
    workspaceId: "w1",
    targets: [],
    inputs: INPUTS,
    branches: BRANCHES,
    canManage: true,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    today: TODAY,
    ...over,
  };
};

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

const renderPage = (url = "/chu-tai-san/chi-tieu/moi") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <Routes>
        <Route path="/chu-tai-san/chi-tieu/moi" element={<OwnerTargetFormPage />} />
        <Route path="/chu-tai-san/chi-tieu/:id/sua" element={<OwnerTargetFormPage />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

const save = (name = "Lưu chỉ tiêu") => fireEvent.click(screen.getByRole("button", { name }));
const lastSave = () => saveMutate.mock.calls.at(-1)?.[0];
const goals = () => screen.getAllByLabelText("Mục tiêu") as HTMLInputElement[];
const location = () => screen.getByTestId("location").textContent;
const preview = () => screen.getByRole("region", { name: "Xem trước chỉ tiêu" });

describe("OwnerTargetFormPage", () => {
  beforeEach(() => {
    saveMutate.mockClear();
    deleteMutate.mockClear();
    setEditor();
  });

  it("đặt mới: tháng này cả đơn vị, tên để trống (placeholder = tên tự sinh), bắt buộc nhập mục tiêu", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Đặt chỉ tiêu" })).toBeInTheDocument();
    const name = screen.getByLabelText("Tên chỉ tiêu");
    expect(name).toHaveValue("");
    expect(name).toHaveAttribute("placeholder", "Tháng 9/2026 · Toàn đơn vị");
    expect(screen.getByRole("button", { name: /^Tháng/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bỏ tiêu chí Số tiền thu hồi" })).toBeDisabled();
    // Gợi ý số kỳ trước (tháng 8, cả đơn vị).
    expect(screen.getByText("6 tỷ")).toBeInTheDocument();
    expect(within(preview()).getByText("Tháng 9/2026")).toBeInTheDocument();
    expect(within(preview()).getByText("Đang diễn ra")).toBeInTheDocument();

    save();
    expect(await screen.findByText("Nhập mục tiêu lớn hơn 0")).toBeInTheDocument();
    expect(saveMutate).not.toHaveBeenCalled();

    fireEvent.change(goals()[0], { target: { value: "12000000000" } });
    expect(goals()[0]).toHaveValue("12,000,000,000");
    expect(within(preview()).getByText("12 tỷ")).toBeInTheDocument();
    save();
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    expect(lastSave()).toEqual({
      p_workspace_id: "w1",
      p_target_id: null,
      p_branch_id: null,
      p_period_type: "month",
      p_period_start: "2026-09-01",
      p_name: null,
      p_criteria: [{ metric: "recovered_amount", goal: "12000000000" }],
    });
    // Lưu xong ⇒ sang trang chi tiết của chỉ tiêu vừa lưu.
    act(() => saveMutate.mock.calls[0][1].onSuccess("t-new"));
    expect(location()).toBe("/chu-tai-san/chi-tieu/t-new");
  });

  it("thêm nhiều tiêu chí, đặt tên riêng; thứ tự tiêu chí giữ nguyên khi lưu", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Tên chỉ tiêu"), { target: { value: "Thu hồi nợ xấu" } });
    expect(screen.getByText("14/120")).toBeInTheDocument();
    fireEvent.change(goals()[0], { target: { value: "5000000000" } });

    fireEvent.click(screen.getByRole("button", { name: "Thêm tiêu chí" }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm tiêu chí" }));
    expect(goals()).toHaveLength(3);
    expect(screen.getByText("3/4")).toBeInTheDocument();
    fireEvent.change(goals()[1], { target: { value: "9000000000" } });
    fireEvent.change(goals()[2], { target: { value: "4" } });

    fireEvent.click(screen.getByRole("button", { name: "Thêm tiêu chí" }));
    // Đủ 4 loại ⇒ hết nút thêm.
    expect(screen.queryByRole("button", { name: "Thêm tiêu chí" })).not.toBeInTheDocument();
    expect(screen.getByText("Đã dùng đủ 4 loại tiêu chí.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ tiêu chí Số tài sản đưa ra đấu giá" }));

    save();
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    expect(lastSave()).toMatchObject({
      p_name: "Thu hồi nợ xấu",
      p_criteria: [
        { metric: "recovered_amount", goal: "5000000000" },
        { metric: "winning_total", goal: "9000000000" },
        { metric: "sold_count", goal: "4" },
      ],
    });
  });

  it("mở sẵn ở chỗ còn trống: tháng này cả đơn vị đã có ⇒ chi nhánh", () => {
    setEditor({ targets: [target()] });
    renderPage();
    expect(screen.getByLabelText("Tên chỉ tiêu")).toHaveAttribute("placeholder", "Tháng 9/2026 · Chi nhánh Hà Nội");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("chọn trúng kỳ + phạm vi đã có chỉ tiêu ⇒ cảnh báo, khoá nút lưu, link sửa chỉ tiêu đó", () => {
    setEditor({
      targets: [target({ id: "t-q", periodType: "quarter", periodStart: "2026-07-01", name: "Quý III toàn đơn vị" })],
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^Quý/ }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Đã có chỉ tiêu Quý III toàn đơn vị cho kỳ và phạm vi này.");
    expect(screen.getByRole("button", { name: "Lưu chỉ tiêu" })).toBeDisabled();
    fireEvent.click(within(alert).getByRole("button", { name: "Sửa chỉ tiêu đó" }));
    expect(location()).toBe("/chu-tai-san/chi-tieu/t-q/sua");
  });

  it("sửa: nạp tên + tiêu chí, lưu theo id, không tự báo trùng với chính nó", async () => {
    setEditor({
      targets: [
        target({
          name: "Chỉ tiêu tháng",
          criteria: [
            { metric: "recovered_amount", goal: 20_000_000_000 },
            { metric: "offered_count", goal: 8 },
          ],
        }),
      ],
    });
    renderPage("/chu-tai-san/chi-tieu/t-month/sua");
    expect(screen.getByRole("heading", { level: 1, name: "Sửa chỉ tiêu" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Chỉ tiêu tháng")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên chỉ tiêu")).toHaveValue("Chỉ tiêu tháng");
    expect(goals().map((g) => g.value)).toEqual(["20,000,000,000", "8"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    save("Lưu thay đổi");
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    expect(lastSave()).toMatchObject({ p_target_id: "t-month", p_name: "Chỉ tiêu tháng" });
  });

  it("xoá phải bấm hai lần, xong về danh sách", () => {
    setEditor({ targets: [target()] });
    renderPage("/chu-tai-san/chi-tieu/t-month/sua");
    fireEvent.click(screen.getByRole("button", { name: "Xoá chỉ tiêu" }));
    expect(deleteMutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Bấm lần nữa để xoá" }));
    expect(deleteMutate).toHaveBeenCalledWith("t-month", expect.anything());
    act(() => deleteMutate.mock.calls[0][1].onSuccess());
    expect(location()).toBe("/chu-tai-san/chi-tieu");
  });

  it("Huỷ: sửa ⇒ về chi tiết, đặt mới ⇒ về danh sách", () => {
    setEditor({ targets: [target()] });
    const { unmount } = renderPage("/chu-tai-san/chi-tieu/t-month/sua");
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(location()).toBe("/chu-tai-san/chi-tieu/t-month");
    unmount();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(location()).toBe("/chu-tai-san/chi-tieu");
  });

  it("người chỉ xem ⇒ về trang xem; chỉ tiêu đã hết kỳ ⇒ về chi tiết", () => {
    setEditor({ canManage: false });
    const { unmount } = renderPage();
    expect(location()).toBe("/chu-tai-san/chi-tieu");
    unmount();

    setEditor({ targets: [target({ periodStart: "2026-08-01" })] });
    renderPage("/chu-tai-san/chi-tieu/t-month/sua");
    expect(location()).toBe("/chu-tai-san/chi-tieu/t-month");
  });

  it("sửa chỉ tiêu không có trong không gian ⇒ không tìm thấy", () => {
    renderPage("/chu-tai-san/chi-tieu/khong-co/sua");
    expect(screen.getByText("Không tìm thấy chỉ tiêu")).toBeInTheDocument();
  });
});
