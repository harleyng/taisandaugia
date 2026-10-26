import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AdminUnit } from "@/lib/adminUnits";
import type { AuctionPlan, AuctionPlanItem, AuctionPlanItemStep, AuctionPlanStatus } from "@/lib/auctionPlan/types";
import type { PlanItemHealth } from "@/lib/auctionPlan/health";
import OwnerAuctionPlanDetailPage from "./OwnerAuctionPlanDetailPage";

/* ─── Dữ liệu mẫu ─────────────────────────────────────────────────────────── */

const plan = (status: AuctionPlanStatus): AuctionPlan =>
  ({
    id: "p1",
    workspace_id: "w1",
    branch_id: "b1",
    admin_unit_code: "24127",
    cycle_id: null,
    plan_year: 2027,
    kind: "annual",
    title: null,
    level: "commune",
    status,
    baseline_version: status === "approved" ? 1 : 0,
    approval_doc_no: null,
    approval_doc_date: null,
    approval_doc_urls: [],
    legal_basis: null,
    notes: null,
    submitted_at: null,
    submitted_by: null,
    reviewed_at: null,
    reviewed_by: null,
    review_comment: status === "returned" ? "Thiếu căn cứ giá khởi điểm của lô LK1-10." : null,
    created_by: null,
    created_at: "2026-10-26T00:00:00Z",
    updated_at: "2026-10-26T00:00:00Z",
  }) as AuctionPlan;

const ITEMS: AuctionPlanItem[] = [
  {
    id: "i1",
    plan_id: "p1",
    workspace_id: "w1",
    branch_id: "b1",
    admin_unit_code: "24127",
    seq: 1,
    item_code: "KH27-001",
    asset_type: "land_use_right",
    title: "Lô LK1-10, khu dân cư Đồng Chùa",
    lot_labels: "LK1-10",
    lot_count: 1,
    map_sheet: "45",
    parcel_no: "123",
    location: "Giáp đường bê tông 5 m",
    area_m2: 120,
    land_use_code: "ONT",
    allocation_form: "giao_co_thu_tien",
    unit_start_price: 12_000_000,
    expected_start_value: 1_440_000_000,
    planned_month: "2027-06-01",
    planned_method: "truc_tiep_loi_noi",
    executing_unit: "Phòng Kinh tế",
    forecast_month: null,
    forecast_reason: null,
    responsible_user_id: null,
    asset_posting_id: null,
    listing_id: null,
    exec_status: "active",
    exec_note: null,
    created_by: null,
    created_at: "2026-10-26T00:00:00Z",
    updated_at: "2026-10-26T00:00:00Z",
  } as AuctionPlanItem,
];

/** Một mốc công việc mẫu của tài sản i1. */
const step = (over: Partial<AuctionPlanItemStep>): AuctionPlanItemStep =>
  ({
    id: "s0",
    item_id: "i1",
    plan_id: "p1",
    workspace_id: "w1",
    branch_id: "b1",
    step: "legal_ready",
    sort_order: 1,
    planned_date: null,
    done_on: null,
    doc_no: null,
    doc_date: null,
    evidence_urls: [],
    source: "manual",
    note: null,
    created_at: "2026-10-26T00:00:00Z",
    updated_at: "2026-10-26T00:00:00Z",
    ...over,
  }) as AuctionPlanItemStep;

/** Một dòng của lưới tiến độ (hình dạng `PlanItemProgress`). */
const progressRow = (
  over: { health?: PlanItemHealth; baselineMonth?: string | null; steps?: AuctionPlanItemStep[]; outcome?: unknown } = {},
) => {
  const steps = over.steps ?? [step({})];
  return {
    item: ITEMS[0],
    steps,
    outcome: over.outcome ?? null,
    health: over.health ?? "on_track",
    baselineMonth: over.baselineMonth ?? ITEMS[0].planned_month,
    progress: {
      done: steps.filter((st) => !!st.done_on).length,
      total: steps.length,
      next: steps.find((st) => !st.done_on) ?? null,
      overdue: [] as AuctionPlanItemStep[],
    },
  };
};

/* ─── Mocks ───────────────────────────────────────────────────────────────── */


const mutation = () => ({ mutate: vi.fn(), isPending: false });

const COMMUNE: AdminUnit = {
  code: "24127",
  name: "Xã Tân Dĩnh",
  level: "commune",
  unit_type: "xa",
  parent_code: "24",
  legacy_names: [],
  is_active: true,
};
const PROVINCES: AdminUnit[] = [
  { code: "24", name: "Tỉnh Bắc Ninh", level: "province", unit_type: "tinh", parent_code: null, legacy_names: [], is_active: true },
];
let detail: Record<string, unknown>;

vi.mock("@/hooks/useAuctionPlan", () => ({
  useAuctionPlanDetail: () => detail,
  useReopenPlan: () => mutation(),
  useSavePlanItem: () => mutation(),
  useDeletePlanItem: () => mutation(),
  useImportPlanItems: () => mutation(),
  useSubmitPlan: () => mutation(),
}));

/** Luồng duyệt (Phase 4) — tab "Phê duyệt & lịch sử" và các nút của cấp trên. */
let reviewerOk = false;

vi.mock("@/hooks/useAuctionPlanApproval", () => ({
  usePlanReviewerOk: () => ({ data: reviewerOk, isLoading: false }),
  usePlanCanApprove: () => ({ data: reviewerOk }),
  usePlanBaselines: () => ({ data: [] as never[], isLoading: false }),
  usePlanBaselineDiff: () => ({ data: null as never, isLoading: false }),
  usePlanHistory: () => ({ data: { rows: [] as never[], level: "workspace" }, isLoading: false }),
  useReturnPlan: () => mutation(),
  useRecordPlanApproval: () => mutation(),
  useStartPlanAdjustment: () => mutation(),
  uploadPlanDoc: vi.fn(),
  planDocSignedUrl: vi.fn(),
  PLAN_DOC_ACCEPT: "application/pdf",
  PLAN_DOC_MAX_SIZE: 10 * 1024 * 1024,
  PLAN_RETURN_MIN_COMMENT: 10,
}));

/** Theo dõi thực hiện (Phase 5) — mốc, kết quả thực tế, sức khoẻ. */
let progressRows: unknown[] = [];
let pendingPlatform = 0;

vi.mock("@/hooks/useAuctionPlanProgress", () => ({
  usePlanProgress: () => ({
    rows: progressRows,
    asOf: "2026-10-26",
    pendingPlatform,
    isLoading: false,
    isError: false,
  }),
  usePlanItemSteps: () => ({ data: [] as never[], isLoading: false }),
  usePlanItemOutcomes: () => ({ data: [] as never[], isLoading: false }),
  usePlanPlatformSteps: () => ({ data: [] as never[], isLoading: false }),
  useSyncPlatformSteps: () => mutation(),
  useSavePlanStep: () => mutation(),
  useSavePlanItemExec: () => mutation(),
  useSetPlanItemExecStatus: () => mutation(),
}));

/** Phase 10 — công khai danh mục dự kiến + số người theo dõi. */
let publicState: Record<string, unknown> | null = {
  optIn: false,
  showPrices: false,
  canManage: true,
  publicItemCount: 3,
  followTotal: 0,
};
let followCounts = new Map<string, number>();

vi.mock("@/hooks/useAuctionPlanPublic", () => ({
  usePlanPublicState: () => ({ data: publicState, isLoading: false }),
  usePlanItemFollowCounts: () => ({ data: followCounts }),
  useSetPlanPublic: () => mutation(),
}));

vi.mock("@/hooks/usePlanLinkOptions", () => ({
  useWorkspacePostingOptions: () => ({ data: [] as never[], isLoading: false }),
  usePlanListingOptions: () => ({ data: [] as never[], isLoading: false }),
}));

vi.mock("@/hooks/useOwnerWorkspaceMembers", () => ({
  useOwnerWorkspaceMembers: () => ({ data: [] as never[], isLoading: false }),
}));

vi.mock("@/hooks/useAuctionPlanCarryForward", () => ({
  usePlanCarryForward: () => ({ previousYear: 2026, hasPreviousPlan: false, candidates: [] as never[], isLoading: false }),
  carryForwardPayload: (c: unknown) => c,
}));

vi.mock("@/hooks/useWorkspaceBranches", () => ({
  useWorkspaceBranches: () => ({
    branches: [{ id: "b1", display_name: "Xã Tân Dĩnh", asset_owner_name: null as string | null }],
    branchesLoading: false,
  }),
}));

vi.mock("@/hooks/useAdminUnits", () => ({
  useAdminUnit: () => ({
    data: COMMUNE,
  }),
  useAdminUnits: () => ({
    data: PROVINCES,
  }),
}));

/** Quyền mặc định = cán bộ xã có đủ quyền ghi trên kế hoạch NHÁP. */
const setDetail = (over: Record<string, unknown> = {}) => {
  const status = (over.status as AuctionPlanStatus) ?? "draft";
  const open = status === "draft" || status === "adjusting";
  const writer = over.writer !== false;
  detail = {
    workspaceId: "w1",
    plan: plan(status),
    items: ITEMS,
    canEditBaseline: open && writer,
    canCreateItem: open && writer,
    canDelete: open && writer,
    canFinalize: writer,
    canReopen: writer,
    canUpdateExec: writer,
    baselineOpen: open,
    isLoading: false,
    itemsLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  };
};

const renderPage = (search = "") =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[`/chu-tai-san/ke-hoach/p1${search}`]}>
        <Routes>
          <Route path="/chu-tai-san/ke-hoach/:id" element={<OwnerAuctionPlanDetailPage />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );

/* ─── Kiểm thử ────────────────────────────────────────────────────────────── */

describe("OwnerAuctionPlanDetailPage", () => {
  beforeEach(() => {
    reviewerOk = false;
    pendingPlatform = 0;
    progressRows = [];
    publicState = { optIn: false, showPrices: false, canManage: true, publicItemCount: 3, followTotal: 0 };
    followCounts = new Map<string, number>();
    setDetail();
  });

  it("shows the plan, its unit and the totals of the catalogue", () => {
    renderPage();
    expect(screen.getByText(/Kế hoạch đấu giá QSDĐ năm 2027/)).toBeInTheDocument();
    expect(screen.getByText(/Xã Tân Dĩnh, Tỉnh Bắc Ninh/)).toBeInTheDocument();
    expect(screen.getByText("Nháp")).toBeInTheDocument();
    // 1,440,000,000 đồng ⇒ "1.4 tỷ" theo moneyShortParts.
    expect(screen.getByText("1.4")).toBeInTheDocument();
  });

  it("a draft offers every write action", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Trình kế hoạch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm tài sản/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nhập từ Excel/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chuyển tiếp từ năm trước/ })).toBeInTheDocument();
    // Bảng desktop và danh sách mobile cùng nằm trong DOM (ẩn bằng CSS, jsdom không có CSS).
    expect(screen.getAllByRole("button", { name: /Sửa KH27-001/ })).toHaveLength(2);
  });

  // Tiêu chí nghiệm thu: kế hoạch đã trình thì không sửa được danh mục.
  it("a submitted plan has no write action and the row opens read-only", () => {
    setDetail({ status: "submitted" });
    renderPage();
    expect(screen.getByText("Đã trình")).toBeInTheDocument();
    expect(screen.getByText("Đang chờ cấp trên xem xét.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trình kế hoạch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm tài sản/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nhập từ Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sửa KH27-001/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Xem KH27-001/ })).toHaveLength(2);
  });

  it("an approved plan keeps the catalogue locked and offers the adjustment", () => {
    setDetail({ status: "approved" });
    renderPage();
    expect(screen.getByText("Đã duyệt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Điều chỉnh kế hoạch/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm tài sản/ })).not.toBeInTheDocument();
  });

  // Phase 4: không có quyền trình ⇒ không mở được điều chỉnh.
  it("an approved plan without the finalize permission stays read-only", () => {
    setDetail({ status: "approved", writer: false });
    renderPage();
    expect(screen.getByText("Đã duyệt — danh mục đang khoá.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Điều chỉnh kế hoạch/ })).not.toBeInTheDocument();
  });

  // Tiêu chí nghiệm thu: cấp trên trả lại hoặc ghi nhận phê duyệt kế hoạch đã trình.
  it("the reviewer of a submitted plan gets both decisions", () => {
    reviewerOk = true;
    setDetail({ status: "submitted" });
    renderPage();
    expect(screen.getByRole("button", { name: /Ghi nhận phê duyệt/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Trả lại/ })).toBeInTheDocument();
    expect(screen.queryByText("Đang chờ cấp trên xem xét.")).not.toBeInTheDocument();
  });

  // Tiêu chí nghiệm thu: người chỉ xem không thấy nút ghi nào.
  it("a viewer sees no write buttons at all", () => {
    setDetail({ writer: false });
    renderPage();
    expect(screen.queryByRole("button", { name: "Trình kế hoạch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm tài sản/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nhập từ Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chuyển tiếp/ })).not.toBeInTheDocument();
    expect(screen.getByText("Bạn không có quyền trình kế hoạch.")).toBeInTheDocument();
    // Xuất Excel là thao tác ĐỌC ⇒ người chỉ xem vẫn dùng được.
    expect(screen.getByRole("button", { name: /Xuất Excel/ })).toBeInTheDocument();
  });

  // `returned` KHÔNG mở khoá trường mốc ⇒ phải mở lại trước khi sửa.
  it("a returned plan shows the comment and the reopen action instead of editing", () => {
    setDetail({ status: "returned" });
    renderPage();
    expect(screen.getByText(/Thiếu căn cứ giá khởi điểm/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mở lại để sửa/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm tài sản/ })).not.toBeInTheDocument();
  });

  it("the two later tabs are placeholders, the catalogue tab is live", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /Danh mục tài sản/ })).toHaveAttribute("data-state", "active");
    for (const name of ["Tiến độ", "Theo kỳ", "Phê duyệt & lịch sử"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByText(/Lô LK1-10, khu dân cư Đồng Chùa/).length).toBeGreaterThan(0);
  });

  // Phase 4: tab lịch sử trả lời "kế hoạch đang ở đâu" và mở được bản in theo mẫu.
  it("the approval tab shows where the plan stands, the baselines and the print link", () => {
    setDetail({ status: "approved" });
    renderPage("?tab=phe-duyet");
    expect(screen.getByRole("tab", { name: /Phê duyệt & lịch sử/ })).toHaveAttribute("data-state", "active");
    expect(screen.getByText(/Đã duyệt ngày .* · bản mốc v1\./)).toBeInTheDocument();
    expect(screen.getByText("Chưa có bản mốc nào.")).toBeInTheDocument();
    expect(screen.getByText("Chưa có bước xử lý nào được ghi lại.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /In theo mẫu/ })).toBeInTheDocument();
  });

  // ─── Phase 10: công khai danh mục dự kiến ─────────────────────────────────

  it("the approval tab offers the public opt-in with its two separate switches", () => {
    setDetail({ status: "approved" });
    renderPage("?tab=phe-duyet");
    expect(screen.getByText("Công khai danh mục dự kiến")).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Công khai danh mục trên trang tìm tài sản" }),
    ).not.toBeDisabled();
    // Công tắc giá là RIÊNG và khoá cho tới khi danh mục được công khai.
    expect(screen.getByRole("switch", { name: "Kèm giá khởi điểm dự kiến" })).toBeDisabled();
    expect(screen.getByText(/3 tài sản của bản mốc đã duyệt/)).toBeInTheDocument();
  });

  it("a plan that is not approved cannot be published", () => {
    setDetail({ status: "draft" });
    renderPage("?tab=phe-duyet");
    expect(screen.getByRole("switch", { name: "Công khai danh mục trên trang tìm tài sản" })).toBeDisabled();
    expect(screen.getByText("Chỉ bật được khi kế hoạch đã được phê duyệt.")).toBeInTheDocument();
  });

  it("a member without the approve permission sees the card read-only, with the follow total", () => {
    publicState = { optIn: true, showPrices: false, canManage: false, publicItemCount: 3, followTotal: 12 };
    setDetail({ status: "approved" });
    renderPage("?tab=phe-duyet");
    expect(screen.getByRole("switch", { name: "Công khai danh mục trên trang tìm tài sản" })).toBeDisabled();
    expect(screen.getByText(/Chỉ cấp trên hoặc Trưởng đơn vị bật \/ tắt được công khai\./)).toBeInTheDocument();
    expect(screen.getByText(/12 lượt theo dõi trên cả kế hoạch/)).toBeInTheDocument();
  });

  it("a returned plan links from the comment to the history tab", () => {
    setDetail({ status: "returned" });
    renderPage();
    expect(screen.getByRole("button", { name: /Xem lịch sử xử lý/ })).toBeInTheDocument();
  });

  // ─── Phase 5: tab "Tiến độ" ───────────────────────────────────────────────
  //
  // Không có cách nghiệm thu bằng trình duyệt (cổng /chu-tai-san/* nằm sau
  // ProtectedRoute và agent không có tài khoản) ⇒ các test DOM dưới đây là bằng
  // chứng thay thế cho lưới, chú giải và ngăn chi tiết.

  it("the progress tab always shows the legend above the 12-month grid", () => {
    progressRows = [progressRow()];
    renderPage("?tab=tien-do");
    expect(screen.getByRole("tab", { name: "Tiến độ" })).toHaveAttribute("data-state", "active");
    const legend = screen.getByRole("list", { name: "Chú giải lưới tiến độ" });
    expect(legend).toBeInTheDocument();
    for (const label of ["Tháng theo bản mốc", "Dự kiến mới", "Đã đấu thành", "Trễ kế hoạch"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // 12 cột tháng + cột tài sản + cột "Mốc"
    expect(screen.getAllByRole("columnheader")).toHaveLength(14);
  });

  it("a past planned month with no outcome reads 'Trễ kế hoạch' on the row", () => {
    progressRows = [progressRow({ health: "late", baselineMonth: "2026-05-01" })];
    renderPage("?tab=tien-do");
    expect(screen.getByRole("button", { name: /KH27-001 .* Trễ kế hoạch/ })).toBeInTheDocument();
  });

  it("an overdue step reads 'Nguy cơ trễ'", () => {
    progressRows = [progressRow({ health: "at_risk" })];
    renderPage("?tab=tien-do");
    expect(screen.getByRole("button", { name: /KH27-001 .* Nguy cơ trễ/ })).toBeInTheDocument();
  });

  it("offers the platform sync with its pending count, and hides it from a viewer", () => {
    progressRows = [progressRow()];
    pendingPlatform = 3;
    renderPage("?tab=tien-do");
    expect(screen.getByRole("button", { name: /Đồng bộ từ dữ liệu sàn \(3\)/ })).toBeInTheDocument();

    setDetail({ writer: false });
    renderPage("?tab=tien-do");
    expect(screen.queryAllByRole("button", { name: /Đồng bộ từ dữ liệu sàn/ })).toHaveLength(1);
  });

  it("the side sheet lists the steps, their source badge and the unlinked hint", () => {
    progressRows = [
      progressRow({
        steps: [
          step({ id: "s1", step: "legal_ready", sort_order: 1, done_on: "2026-04-11", source: "manual" }),
          step({ id: "s2", step: "contract_signed", sort_order: 5, done_on: "2026-05-20", source: "platform" }),
          step({ id: "s3", step: "paid", sort_order: 9, planned_date: "2026-09-01" }),
        ],
      }),
    ];
    renderPage("?tab=tien-do");
    fireEvent.click(screen.getByRole("button", { name: /KH27-001/ }));
    expect(screen.getByText("1. Hoàn thiện hồ sơ pháp lý thửa đất")).toBeInTheDocument();
    expect(screen.getByText("5. Ký hợp đồng dịch vụ đấu giá")).toBeInTheDocument();
    expect(screen.getByText("Sàn xác nhận")).toBeInTheDocument();
    expect(screen.getByText("Tự khai")).toBeInTheDocument();
    expect(screen.getByText("Liên kết hồ sơ để tự cập nhật kết quả")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tạo hồ sơ số hoá từ mục này/ })).toBeInTheDocument();
  });

  it("the side sheet shows the public follow count of the item, and nothing when there is none", () => {
    progressRows = [progressRow()];
    renderPage("?tab=tien-do");
    fireEvent.click(screen.getByRole("button", { name: /KH27-001/ }));
    expect(screen.queryByText(/người đang theo dõi tài sản này/)).not.toBeInTheDocument();
  });

  it("the side sheet shows how many buyers follow the item", () => {
    progressRows = [progressRow()];
    followCounts = new Map([["i1", 12]]);
    renderPage("?tab=tien-do");
    fireEvent.click(screen.getByRole("button", { name: /KH27-001/ }));
    expect(screen.getByText("12 người đang theo dõi tài sản này")).toBeInTheDocument();
  });

  it("dropping an item is blocked while the baseline is locked", () => {
    setDetail({ status: "approved" });
    progressRows = [progressRow()];
    renderPage("?tab=tien-do");
    fireEvent.click(screen.getByRole("button", { name: /KH27-001/ }));
    expect(screen.getByRole("button", { name: /Bỏ khỏi kế hoạch/ })).toBeDisabled();
    expect(screen.getByText(/thay đổi bản mốc — mở "Điều chỉnh kế hoạch" trước/)).toBeInTheDocument();
  });
});
