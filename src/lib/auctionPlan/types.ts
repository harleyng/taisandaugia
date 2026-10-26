// Kế hoạch đấu giá — kiểu dữ liệu và nhãn tiếng Việt.
//
// ⚠️ NGUỒN KIỂU DUY NHẤT cho module này. `src/integrations/supabase/types.ts`
// KHÔNG sinh lại được ở máy hiện tại (token CLI thuộc tài khoản Supabase khác,
// `--db-url` cần Docker) nên các bảng `auction_plan_*` KHÔNG có trong kiểu tự
// sinh. Mọi truy vấn tới chúng phải ép `(supabase as any)` — đúng cách
// `useWorkspaceBranches` đang làm với `admin_units` — rồi gán về các kiểu ở
// đây. Khi nào sinh lại được types.ts thì giữ file này làm nhãn + union hẹp.
//
// Bản sao của migration 20261026110000 (Phase 2 của docs/owner-auction-planning-plan.md,
// mục A4). Nới CHECK ở DB thì phải nới union NGAY trong cùng lần đó
// (common-pitfalls.md 2026-09-12: union hẹp hơn CHECK = nhãn trống, không phải
// lỗi biên dịch).

/* ─── Union khớp CHECK của DB ─────────────────────────────────────────────── */

export type AuctionPlanCycleKind = "annual" | "supplement";
export type AuctionPlanCycleStatus = "open" | "closed";

export type AuctionPlanKind = AuctionPlanCycleKind;
export type AuctionPlanLevel = "commune" | "province" | "consolidated";
export type AuctionPlanStatus = "draft" | "submitted" | "returned" | "approved" | "adjusting" | "closed";

export type AuctionPlanAssetType = "land_use_right" | "public_asset" | "other";
export type AuctionPlanAllocationForm =
  | "giao_co_thu_tien"
  | "thue_tra_mot_lan"
  | "thue_tra_hang_nam"
  | "khac";
export type AuctionPlanMethod =
  | "truc_tiep_loi_noi"
  | "bo_phieu_gian_tiep"
  | "bo_phieu_truc_tiep"
  | "truc_tuyen"
  | "chua_xac_dinh";
export type AuctionPlanItemExecStatus = "active" | "dropped";

export type AuctionPlanStep =
  | "legal_ready"
  | "start_price"
  | "plan_approved"
  | "org_selected"
  | "contract_signed"
  | "announced"
  | "auction_held"
  | "result_approved"
  | "paid"
  | "handed_over";
export type AuctionPlanStepSource = "manual" | "platform";

/* ─── Dòng dữ liệu (khớp cột của DB) ──────────────────────────────────────── */

export interface AuctionPlanCycle {
  id: string;
  workspace_id: string;
  plan_year: number;
  kind: AuctionPlanCycleKind;
  status: AuctionPlanCycleStatus;
  submit_deadline: string | null;
  instructions: string | null;
  attachment_urls: string[];
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionPlanCycleUnit {
  id: string;
  cycle_id: string;
  workspace_id: string;
  admin_unit_code: string;
  /** Hình A — xã là chi nhánh của Trạm tỉnh. Loại trừ với `child_workspace_id`. */
  branch_id: string | null;
  /** Hình B — xã có Trạm riêng, đã liên kết làm con. */
  child_workspace_id: string | null;
  assigned_revenue: number | null;
  assigned_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionPlan {
  id: string;
  workspace_id: string;
  branch_id: string | null;
  admin_unit_code: string;
  cycle_id: string | null;
  plan_year: number;
  kind: AuctionPlanKind;
  title: string | null;
  level: AuctionPlanLevel;
  status: AuctionPlanStatus;
  /** 0 = chưa từng duyệt. Tăng 1 ở mỗi lần ghi nhận phê duyệt. */
  baseline_version: number;
  approval_doc_no: string | null;
  approval_doc_date: string | null;
  approval_doc_urls: string[];
  legal_basis: string | null;
  notes: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionPlanItem {
  id: string;
  plan_id: string;
  /** Ép từ kế hoạch cha bởi trigger — client KHÔNG được gửi 3 cột này. */
  workspace_id: string;
  branch_id: string | null;
  admin_unit_code: string;

  // Trường MỐC — khoá khi kế hoạch không ở draft / adjusting
  seq: number;
  item_code: string;
  asset_type: AuctionPlanAssetType;
  title: string;
  lot_labels: string | null;
  lot_count: number | null;
  map_sheet: string | null;
  parcel_no: string | null;
  location: string | null;
  area_m2: number | null;
  land_use_code: string | null;
  allocation_form: AuctionPlanAllocationForm | null;
  unit_start_price: number | null;
  expected_start_value: number | null;
  /** Ngày 01 của tháng, trong năm kế hoạch. */
  planned_month: string | null;
  planned_method: AuctionPlanMethod;
  executing_unit: string | null;

  // Trường THỰC HIỆN — sửa tự do với ke-hoach:update
  forecast_month: string | null;
  forecast_reason: string | null;
  responsible_user_id: string | null;
  asset_posting_id: string | null;
  listing_id: string | null;
  exec_status: AuctionPlanItemExecStatus;
  exec_note: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionPlanItemStep {
  id: string;
  item_id: string;
  /** Ép từ tài sản cha bởi trigger. */
  plan_id: string;
  workspace_id: string;
  branch_id: string | null;
  step: AuctionPlanStep;
  sort_order: number;
  planned_date: string | null;
  done_on: string | null;
  doc_no: string | null;
  doc_date: string | null;
  evidence_urls: string[];
  /** Client KHÔNG có quyền cột này — nhãn "Sàn xác nhận" là lời của sàn. */
  source: AuctionPlanStepSource;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload đóng băng của một lần phê duyệt (A4.5). */
export interface AuctionPlanBaselinePayload {
  plan: {
    id: string;
    plan_year: number;
    kind: AuctionPlanKind;
    level: AuctionPlanLevel;
    title: string | null;
    admin_unit_code: string;
    branch_id: string | null;
    cycle_id: string | null;
    legal_basis: string | null;
  };
  items: Array<
    Pick<
      AuctionPlanItem,
      | "id"
      | "seq"
      | "item_code"
      | "asset_type"
      | "title"
      | "lot_labels"
      | "lot_count"
      | "map_sheet"
      | "parcel_no"
      | "location"
      | "area_m2"
      | "land_use_code"
      | "allocation_form"
      | "unit_start_price"
      | "expected_start_value"
      | "planned_month"
      | "planned_method"
      | "executing_unit"
    >
  >;
  totals: {
    item_count: number;
    area_total: number;
    expected_total: number;
    /** Khoá "2027-03" → { count, expected }. */
    by_month: Record<string, { count: number; expected: number }>;
    /** Khoá "2027-Q1" → { count, expected }. */
    by_quarter: Record<string, { count: number; expected: number }>;
  };
  frozen_at: string;
}

export interface AuctionPlanBaseline {
  id: string;
  plan_id: string;
  workspace_id: string;
  branch_id: string | null;
  version: number;
  approved_at: string;
  approved_by: string | null;
  approval_doc_no: string | null;
  approval_doc_date: string | null;
  approval_doc_urls: string[];
  payload: AuctionPlanBaselinePayload;
  created_at: string;
}

/** Kết quả `auction_plan_baseline_diff` — luật D4 / A4.6. */
export type AuctionPlanBaselineDiff =
  | { baseline: false }
  | {
      baseline: true;
      /** Mã tài sản thêm mới so với bản mốc. */
      added: string[];
      /** Mã tài sản đã bỏ khỏi kế hoạch. */
      dropped: string[];
      /** Mã tài sản dời sang QUÝ khác. */
      moved_quarter: string[];
      /** Mã tài sản đổi giá trị khởi điểm dự kiến quá 10%. */
      value_shift: string[];
    };

/* ─── Nhãn tiếng Việt ─────────────────────────────────────────────────────── */

export const AUCTION_PLAN_STATUS_LABELS: Record<AuctionPlanStatus, string> = {
  draft: "Nháp",
  submitted: "Đã trình",
  returned: "Bị trả lại",
  approved: "Đã duyệt",
  adjusting: "Đang điều chỉnh",
  closed: "Đã đóng",
};

export const AUCTION_PLAN_KIND_LABELS: Record<AuctionPlanKind, string> = {
  annual: "Kế hoạch năm",
  supplement: "Kế hoạch bổ sung",
};

export const AUCTION_PLAN_LEVEL_LABELS: Record<AuctionPlanLevel, string> = {
  commune: "Cấp xã",
  province: "Cấp tỉnh",
  consolidated: "Tổng hợp",
};

export const AUCTION_PLAN_CYCLE_STATUS_LABELS: Record<AuctionPlanCycleStatus, string> = {
  open: "Đang mở",
  closed: "Đã đóng",
};

export const AUCTION_PLAN_ASSET_TYPE_LABELS: Record<AuctionPlanAssetType, string> = {
  land_use_right: "Quyền sử dụng đất",
  public_asset: "Tài sản công",
  other: "Khác",
};

export const AUCTION_PLAN_ALLOCATION_FORM_LABELS: Record<AuctionPlanAllocationForm, string> = {
  giao_co_thu_tien: "Giao đất có thu tiền sử dụng đất",
  thue_tra_mot_lan: "Thuê đất trả tiền một lần",
  thue_tra_hang_nam: "Thuê đất trả tiền hằng năm",
  khac: "Khác",
};

export const AUCTION_PLAN_METHOD_LABELS: Record<AuctionPlanMethod, string> = {
  truc_tiep_loi_noi: "Trực tiếp bằng lời nói",
  bo_phieu_gian_tiep: "Bỏ phiếu gián tiếp",
  bo_phieu_truc_tiep: "Bỏ phiếu trực tiếp",
  truc_tuyen: "Trực tuyến",
  chua_xac_dinh: "Chưa xác định",
};

export const AUCTION_PLAN_EXEC_STATUS_LABELS: Record<AuctionPlanItemExecStatus, string> = {
  active: "Trong kế hoạch",
  dropped: "Đã bỏ khỏi kế hoạch",
};

/** Nhãn mốc công việc (A4.4) — thứ tự đúng bằng `auction_plan_step_template`. */
export const AUCTION_PLAN_STEP_LABELS: Record<AuctionPlanStep, string> = {
  legal_ready: "Hoàn thiện hồ sơ pháp lý thửa đất",
  start_price: "Phê duyệt giá khởi điểm",
  plan_approved: "Phê duyệt phương án đấu giá",
  org_selected: "Lựa chọn tổ chức đấu giá",
  contract_signed: "Ký hợp đồng dịch vụ đấu giá",
  announced: "Thông báo công khai",
  auction_held: "Tổ chức phiên đấu giá",
  result_approved: "Phê duyệt kết quả trúng đấu giá",
  paid: "Người trúng nộp đủ tiền",
  handed_over: "Giao đất / cấp giấy chứng nhận",
};

/** Thứ tự mốc theo loại tài sản — bản sao `auction_plan_step_template(asset_type)`. */
export const AUCTION_PLAN_STEP_ORDER: AuctionPlanStep[] = [
  "legal_ready",
  "start_price",
  "plan_approved",
  "org_selected",
  "contract_signed",
  "announced",
  "auction_held",
  "result_approved",
  "paid",
  "handed_over",
];

export function auctionPlanStepsFor(assetType: AuctionPlanAssetType): AuctionPlanStep[] {
  return assetType === "land_use_right"
    ? [...AUCTION_PLAN_STEP_ORDER]
    : AUCTION_PLAN_STEP_ORDER.filter((s) => s !== "legal_ready" && s !== "handed_over");
}

/** Kế hoạch còn mở để sửa trường MỐC (trigger của DB dùng đúng hai trạng thái này). */
export function isAuctionPlanBaselineOpen(status: AuctionPlanStatus): boolean {
  return status === "draft" || status === "adjusting";
}

/** Tên tự sinh khi người dùng để trống (A4.2). */
export function auctionPlanAutoTitle(
  planYear: number,
  unitName: string | null | undefined,
  assetType: AuctionPlanAssetType = "land_use_right",
): string {
  const what = assetType === "land_use_right" ? "QSDĐ" : "tài sản công";
  const unit = unitName?.trim();
  return unit
    ? `Kế hoạch đấu giá ${what} năm ${planYear} · ${unit}`
    : `Kế hoạch đấu giá ${what} năm ${planYear}`;
}

/* ─── Câu chữ lỗi của các RPC luồng duyệt ─────────────────────────────────── */

/**
 * `reason` của auction_plan_submit / return / record_approval / start_adjustment /
 * close / cycle_*. Dùng với `assertRpcOk` (src/lib/consignment/errors.ts): RPC
 * trả `{ok:false, reason}` nên MỌI mutation phải gọi assert, nếu không một lần
 * trình thất bại vẫn hiện toast xanh.
 */
export const AUCTION_PLAN_REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_found: "Không tìm thấy kế hoạch, hoặc bạn không có quyền thao tác.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  not_reviewer: "Chỉ cấp trên (người có quyền Duyệt kế hoạch) mới trả lại hoặc ghi nhận phê duyệt.",
  invalid_status: "Kế hoạch vừa chuyển sang bước khác. Tải lại trang để xem trạng thái mới nhất.",
  no_items: "Kế hoạch chưa có tài sản nào — thêm ít nhất một lô trước khi trình.",
  items_without_month: "Còn tài sản chưa chọn tháng dự kiến.",
  reason_required: "Vui lòng nêu lý do trả lại (ít nhất 10 ký tự).",
  doc_no_required: "Vui lòng nhập số quyết định phê duyệt.",
  invalid_doc_date: "Ngày quyết định không hợp lệ — không được sau hôm nay.",
  invalid_path: "Tệp quyết định không hợp lệ. Vui lòng tải lại tệp.",
  // Đợt lập kế hoạch
  already_open: "Đợt lập kế hoạch của năm này đang mở.",
  cycle_closed: "Đợt lập kế hoạch đã đóng, không giao thêm đơn vị được.",
  invalid_kind: "Loại kế hoạch không hợp lệ.",
  invalid_year: "Năm kế hoạch không hợp lệ.",
  invalid_unit: "Có đơn vị hành chính không hợp lệ trong danh sách.",
  duplicate_unit: "Một đơn vị hành chính xuất hiện hai lần trong danh sách.",
  invalid_scope: "Chi nhánh hoặc Trạm con không thuộc đơn vị này.",
};

const AUCTION_PLAN_FALLBACK = "Thao tác không thành công. Vui lòng thử lại.";

export function auctionPlanReasonMessage(
  reason: string | null | undefined,
  details?: Record<string, unknown>,
): string {
  if (reason === "items_without_month" && Array.isArray(details?.items) && details.items.length > 0) {
    return `Còn ${details.items.length} tài sản chưa chọn tháng dự kiến: ${(details.items as string[]).join(", ")}.`;
  }
  return (reason && AUCTION_PLAN_REASON_MESSAGES[reason]) || AUCTION_PLAN_FALLBACK;
}

/* ─── Bucket tệp kế hoạch ─────────────────────────────────────────────────── */

export const AUCTION_PLAN_DOCS_BUCKET = "auction-plan-docs";

/** `{workspace_id}/{plan_id}/{tệp}` — policy của bucket kiểm CẢ hai segment đầu. */
export function auctionPlanDocPrefix(workspaceId: string, planId: string): string {
  return `${workspaceId}/${planId}/`;
}

/** `{workspace_id}/dot/{cycle_id}/{tệp}` — tệp hướng dẫn của một đợt. */
export function auctionPlanCycleDocPrefix(workspaceId: string, cycleId: string): string {
  return `${workspaceId}/dot/${cycleId}/`;
}
