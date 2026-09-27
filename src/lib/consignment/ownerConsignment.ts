// Menu "Ký gửi đấu giá" của cổng chủ tài sản: đường dẫn + giai đoạn ký gửi của
// MỘT hồ sơ số hoá.
//
// Số hoá và ký gửi vẫn là MỘT luồng tạo (wizard kết thúc bằng "Hoàn tất & gửi
// tổ chức"), nhưng theo dõi sau đó tách hai nơi: chi tiết hồ sơ chỉ giữ thẻ tóm
// tắt, chi tiết đầy đủ (gửi thêm, so sánh / chốt báo giá, hợp đồng dịch vụ) nằm
// ở đây. Dữ liệu không đổi: ký gửi vẫn là asset_service_requests /
// asset_broker_requests / consignment_contracts treo trên hồ sơ.

import type {
  AssetPostingReviewStatus,
  AssetPostingStatus,
  BrokerRequestStatus,
  ServiceRequestStatus,
} from "@/types/asset-posting";
import type { ConsignmentContractStatus } from "@/types/consignment-contract";

export const OWNER_CONSIGNMENTS_PATH = "/chu-tai-san/ky-gui-dau-gia";

/** Chi tiết ký gửi — khoá theo id HỒ SƠ: mỗi hồ sơ đúng một luồng ký gửi. */
export const ownerConsignmentPath = (postingId: string) => `${OWNER_CONSIGNMENTS_PATH}/${postingId}`;

// ─── Giai đoạn ───────────────────────────────────────────────────────────────

export type OwnerConsignmentStage =
  | "chua_gui"
  | "cho_bao_gia"
  | "cho_chon"
  | "het_to_chuc"
  | "da_chon"
  | "hop_dong"
  | "da_ky";

export interface ConsignmentFacts {
  postingStatus: AssetPostingStatus;
  reviewStatus: AssetPostingReviewStatus | null;
  requestStatuses: ServiceRequestStatus[];
  /** Yêu cầu "nhờ sàn" MỚI NHẤT, null khi chưa từng nhờ. */
  brokerStatus: BrokerRequestStatus | null;
  contractStatuses: ConsignmentContractStatus[];
}

const OPEN_BROKER: readonly BrokerRequestStatus[] = ["pending", "sourcing", "quoted"];
const CHOSEN_REQUEST: readonly ServiceRequestStatus[] = ["selected", "accepted"];
const WAITING_REQUEST: readonly ServiceRequestStatus[] = ["sent", "seen"];

/**
 * Hồ sơ đang ở đâu trong luồng ký gửi. `null` = chưa thuộc menu Ký gửi: nháp,
 * đã huỷ, hoặc chưa được duyệt mà cũng chưa từng gửi (việc còn ở phần số hoá).
 *
 * Thứ tự xét đi từ cuối luồng về đầu — hợp đồng quyết định trước yêu cầu, vì
 * hợp đồng huỷ thì các báo giá cũ mở lại và hồ sơ quay về "Chờ chọn".
 */
export function consignmentStageOf(f: ConsignmentFacts): OwnerConsignmentStage | null {
  if (f.postingStatus === "draft" || f.postingStatus === "cancelled") return null;

  const liveContracts = f.contractStatuses.filter((s) => s !== "cancelled");
  if (liveContracts.includes("signed")) return "da_ky";
  if (liveContracts.length > 0) return "hop_dong";

  // Dữ liệu cũ: chốt tổ chức chưa có tài khoản ⇒ không có hợp đồng trên sàn.
  if (f.requestStatuses.some((s) => CHOSEN_REQUEST.includes(s))) return "da_chon";
  if (f.postingStatus === "contracted") return "da_ky";
  if (f.postingStatus === "matched") return "da_chon";

  if (f.requestStatuses.includes("quoted")) return "cho_chon";
  const brokerOpen = f.brokerStatus !== null && OPEN_BROKER.includes(f.brokerStatus);
  if (brokerOpen || f.requestStatuses.some((s) => WAITING_REQUEST.includes(s))) return "cho_bao_gia";

  // Đã gửi mà mọi tổ chức đều từ chối / bị thu hồi: phải gửi thêm, không thì kẹt.
  if (f.requestStatuses.length > 0) return "het_to_chuc";

  return f.postingStatus === "active" && f.reviewStatus === "approved" ? "chua_gui" : null;
}

// ─── Nhóm lọc ở danh sách (tab của thiết kế) ─────────────────────────────────

export type ConsignmentFilter = "tat-ca" | "can-xu-ly" | "chua-gui" | "cho-bao-gia" | "da-chon";

export const CONSIGNMENT_FILTERS: { key: ConsignmentFilter; label: string }[] = [
  { key: "tat-ca", label: "Tất cả" },
  { key: "can-xu-ly", label: "Cần bạn xử lý" },
  { key: "chua-gui", label: "Chưa gửi" },
  { key: "cho-bao-gia", label: "Đang chờ báo giá" },
  { key: "da-chon", label: "Đã chọn tổ chức" },
];

/** "Cần gửi thêm" và "Chờ chọn báo giá" chỉ nằm ở Tất cả + Cần bạn xử lý (như thiết kế). */
const FILTER_STAGES: Record<Exclude<ConsignmentFilter, "tat-ca" | "can-xu-ly">, readonly OwnerConsignmentStage[]> = {
  "chua-gui": ["chua_gui"],
  // Gồm cả hồ sơ nhờ sàn đang tìm tổ chức (cùng giai đoạn cho_bao_gia).
  "cho-bao-gia": ["cho_bao_gia"],
  "da-chon": ["da_chon", "hop_dong", "da_ky"],
};

/**
 * "Cần bạn xử lý" dùng đúng `owner_action` của RPC owner_consignment_summary —
 * cùng nguồn với số đếm trên menu, để hai con số không bao giờ lệch nhau.
 */
export function matchesConsignmentFilter(
  filter: ConsignmentFilter,
  row: { stage: OwnerConsignmentStage; needsAction: boolean },
): boolean {
  if (filter === "tat-ca") return true;
  if (filter === "can-xu-ly") return row.needsAction;
  return FILTER_STAGES[filter].includes(row.stage);
}
