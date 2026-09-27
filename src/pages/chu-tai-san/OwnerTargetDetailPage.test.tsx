import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { computeTargetProgress, ownerTargetOf, type OwnerTarget, type TargetInput } from "@/lib/ownerTargets";
import type { OutcomeOverviewRow } from "@/lib/ownerOutcomesOverview";
import OwnerTargetDetailPage from "./OwnerTargetDetailPage";

const TODAY = "2026-09-16";

vi.mock("@/hooks/useOwnerWorkspace", () => ({
  useOwnerWorkspace: () => ({ isLoading: false }),
}));

const TARGET: OwnerTarget = ownerTargetOf({
  id: "t1",
  workspaceId: "w1",
  branchId: null,
  periodType: "month",
  periodStart: "2026-09-01",
  name: "Thu hồi tháng 9",
  criteria: [
    { metric: "recovered_amount", goal: 20_000_000_000 },
    { metric: "offered_count", goal: 3 },
  ],
});

const input = (key: string, over: Partial<TargetInput>): TargetInput => ({
  key,
  outcome: "sold",
  day: "2026-09-10",
  branchId: "b1",
  price: 1_000_000_000,
  paymentStatus: null,
  paidAmount: null,
  ...over,
});

const INPUTS = [
  input("a", { price: 8_000_000_000, paymentStatus: "paid", paidAmount: 8_000_000_000, day: "2026-09-05" }),
  input("b", { price: 3_000_000_000, paymentStatus: "pending", day: "2026-09-12" }),
  input("c", { outcome: "unsold", price: null, day: "2026-09-08" }),
  input("d", { price: 9_000_000_000, paymentStatus: "defaulted", day: "2026-09-09" }),
  input("e", { price: 4_000_000_000, day: "2026-08-20" }),
];

const overviewRow = (key: string, title: string, listingId: string | null = null) =>
  [key, { rowKey: key, title, listingId, confidence: null as OutcomeOverviewRow["confidence"], sources: [], hasConflict: false }] as const;
const ROWS = new Map(
  [
    overviewRow("a", "Nhà phố Cầu Giấy", "3f9a12bc-0000-4000-8000-000000000000"),
    overviewRow("b", "Căn hộ Thủ Đức"),
    overviewRow("c", "Đất nền Long An"),
    overviewRow("d", "Kho Bình Dương"),
  ] as unknown as [string, OutcomeOverviewRow][],
);

let detail: Record<string, unknown>;
vi.mock("@/hooks/useOwnerTargets", () => ({
  useOwnerTargetDetail: () => detail,
}));

const setDetail = (over: Record<string, unknown> = {}) => {
  const target = (over.target as OwnerTarget | undefined) ?? TARGET;
  const inputs = (over.inputs as TargetInput[] | undefined) ?? INPUTS;
  detail = {
    workspaceId: "w1",
    targets: [target],
    inputs,
    rowsByKey: ROWS,
    progress: computeTargetProgress(target, inputs, TODAY),
    branches: [{ id: "b1", label: "Chi nhánh Hà Nội", isActive: true, assetOwnerId: "ao1" }],
    canManage: true,
    canUpdate: true,
    canDelete: true,
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

const renderPage = (url = "/chu-tai-san/chi-tieu/t1") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LocationProbe />
      <TooltipProvider>
        <Routes>
          <Route path="/chu-tai-san/chi-tieu/:id" element={<OwnerTargetDetailPage />} />
          <Route path="*" element={null} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  );

const section = (name: RegExp) => screen.getByRole("region", { name });
const location = () => screen.getByTestId("location").textContent;

describe("OwnerTargetDetailPage", () => {
  beforeEach(() => setDetail());

  it("đường dẫn + đầu trang: tên, trạng thái, kỳ · khoảng ngày, phạm vi", () => {
    renderPage();
    const crumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumb).getByText("Đang thực hiện")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Thu hồi tháng 9" })).toBeInTheDocument();
    expect(screen.getByText("Tháng 9/2026 · 01/09/2026 – 30/09/2026")).toBeInTheDocument();
    expect(screen.getByText("Toàn đơn vị")).toBeInTheDocument();
  });

  it("tóm tắt: tiến độ chung (vạch thời gian) + số ngày còn lại", () => {
    renderPage();
    const summary = section(/^Tiến độ$/);
    // Tiền 8/20 tỷ = 40%, đưa ra đấu giá 4/3 = 100% ⇒ trung bình 70%.
    expect(within(summary).getByText("1/2 tiêu chí đạt")).toBeInTheDocument();
    expect(within(summary).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
    expect(within(summary).getByTitle("Thời gian đã qua 50%")).toBeInTheDocument();
    expect(within(summary).getByText("Còn 15 ngày")).toBeInTheDocument();
    expect(within(summary).getByText("01/09")).toBeInTheDocument();
    expect(within(summary).getByText("30/09")).toBeInTheDocument();
  });

  it("thẻ tiêu chí: thực tế / mục tiêu, %, nhịp mỗi tuần hoặc 'Đã đạt · vượt'", () => {
    renderPage();
    const cards = within(section(/^Tiêu chí$/)).getAllByRole("button");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("aria-pressed", "true");
    expect(within(cards[0]).getByText("Số tiền thu hồi")).toBeInTheDocument();
    expect(within(cards[0]).getByText("8 tỷ")).toBeInTheDocument();
    expect(within(cards[0]).getByText("/ 20 tỷ")).toBeInTheDocument();
    expect(within(cards[0]).getByText("40%")).toBeInTheDocument();
    expect(cards[0]).toHaveTextContent("Còn thiếu 12 tỷ · cần 5.6 tỷ/tuần");
    expect(cards[1]).toHaveTextContent("Đã đạt · vượt 1");
  });

  it("số liệu cấu thành: tổng ở đầu thẻ, thanh chia tiền, bảng + dòng Tổng; bỏ cọc không vào bảng", () => {
    renderPage();
    const data = section(/Số liệu cấu thành · Số tiền thu hồi/);
    expect(within(data).getByText("Tiền thu về từ các phiên trong kỳ · Toàn đơn vị")).toBeInTheDocument();
    expect(within(data).getByText("2 tài sản · mục tiêu 20 tỷ")).toBeInTheDocument();
    expect(within(data).getByText("Đã ghi nhận thu")).toBeInTheDocument();
    expect(within(data).getByText(/— chưa tính/)).toBeInTheDocument();

    expect(within(data).getByText("Nhà phố Cầu Giấy")).toBeInTheDocument();
    expect(within(data).getByText("3F9A12BC")).toBeInTheDocument();
    // Chờ thu vẫn hiện (góp 0) để giải thích khoảng thiếu.
    expect(within(data).getByText("Căn hộ Thủ Đức")).toBeInTheDocument();
    expect(within(data).getByText("Chưa thu")).toBeInTheDocument();
    expect(within(data).getByText("Ngoài sàn")).toBeInTheDocument();
    expect(within(data).queryByText("Kho Bình Dương")).not.toBeInTheDocument();
    expect(within(data).queryByText("Đất nền Long An")).not.toBeInTheDocument();
    expect(within(data).getByText(/Tổng · 2 tài sản/)).toBeInTheDocument();
    // Cột chi nhánh bỏ tiền tố "Chi nhánh".
    expect(within(data).getAllByText("Hà Nội")).toHaveLength(2);
  });

  it("bấm thẻ tiêu chí khác ⇒ bảng đổi theo, ghi lên URL", () => {
    renderPage();
    fireEvent.click(within(section(/^Tiêu chí$/)).getByText("Số tài sản đưa ra đấu giá"));
    expect(location()).toBe("/chu-tai-san/chi-tieu/t1?tieu-chi=offered_count");
    const data = section(/Số liệu cấu thành · Số tài sản đưa ra đấu giá/);
    expect(within(data).getByText("Không thành")).toBeInTheDocument();
    expect(within(data).getByText("Đấu thành · bỏ cọc")).toBeInTheDocument();
    expect(within(data).getByText(/Tổng · 4 tài sản/)).toBeInTheDocument();
    expect(within(data).queryByText("Đã ghi nhận thu")).not.toBeInTheDocument();
  });

  it("hơn 5 tài sản ⇒ phân trang 5 dòng/trang", () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      input(`m${i}`, { day: `2026-09-${String(i + 2).padStart(2, "0")}`, paymentStatus: "paid" }),
    );
    setDetail({ inputs: many });
    renderPage();
    const data = section(/Số liệu cấu thành/);
    expect(within(data).getByText("1–5 / 7 tài sản")).toBeInTheDocument();
    expect(within(data).getAllByRole("row")).toHaveLength(1 + 5 + 1);
    fireEvent.click(within(data).getByRole("button", { name: "2" }));
    expect(within(data).getByText("6–7 / 7 tài sản")).toBeInTheDocument();
    expect(within(data).getByRole("button", { name: "Trang sau" })).toBeDisabled();
  });

  it("Trưởng đơn vị: 'Sửa chỉ tiêu' mở trang sửa", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sửa chỉ tiêu" }));
    expect(location()).toBe("/chu-tai-san/chi-tieu/t1/sua");
  });

  it("người chỉ xem: không nút sửa", () => {
    setDetail({ canManage: false, canUpdate: false, canDelete: false });
    renderPage();
    expect(screen.queryByRole("button", { name: "Sửa chỉ tiêu" })).not.toBeInTheDocument();
  });

  it("kỳ đã qua: chỉ xem, trạng thái đã chốt, thẻ báo thiếu", () => {
    setDetail({ target: ownerTargetOf({ ...TARGET, periodStart: "2026-08-01" }) });
    renderPage();
    expect(screen.queryByRole("button", { name: "Sửa chỉ tiêu" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText("Không hoàn thành")).toBeInTheDocument();
    expect(screen.getByText("Không đạt")).toBeInTheDocument();
    expect(screen.getByText("Đã kết thúc")).toBeInTheDocument();
    expect(within(section(/^Tiêu chí$/)).getAllByRole("button")[0]).toHaveTextContent("Thiếu 16 tỷ");
  });

  it("tên tự sinh làm tiêu đề", () => {
    setDetail({ target: ownerTargetOf({ ...TARGET, name: null }) });
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Tháng 9/2026 · Toàn đơn vị" })).toBeInTheDocument();
  });

  it("không có chỉ tiêu trong không gian đang chọn ⇒ trạng thái không tìm thấy", () => {
    setDetail({ progress: null });
    renderPage();
    expect(screen.getByText("Không tìm thấy chỉ tiêu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Về danh sách chỉ tiêu" }));
    expect(location()).toBe("/chu-tai-san/chi-tieu");
  });
});
