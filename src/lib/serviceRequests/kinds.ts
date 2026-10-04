// Registry các loại "Yêu cầu dịch vụ" (menu gộp /admin/yeu-cau-dich-vu).
//
// Mỗi loại vẫn giữ BẢNG + RPC + mã quyền riêng — registry chỉ là lớp trình bày chung
// (tab, nhãn, đường dẫn). Thêm dịch vụ mới = thêm 1 dòng ở đây + bộ chuẩn hoá dòng
// trong normalize.ts. Quét 3D chưa có: luồng tự động (credit + webhook), không báo giá.

import { BadgeCheck, Calculator, Lightbulb, Megaphone, Rotate3d, Scale, type LucideIcon } from "lucide-react";

export const ADMIN_SERVICE_REQUESTS_PATH = "/admin/yeu-cau-dich-vu";

/**
 * Slug = đoạn URL chi tiết, trùng route cũ để link vẫn dễ đọc. Đây là 5 dịch vụ có hợp
 * đồng cung ứng (HDCU) — nhiều bảng ánh xạ của hợp đồng dịch vụ khoá theo kiểu này.
 */
export type ServiceKindKey = "tu-van-phap-ly" | "tu-van-dau-gia" | "tham-dinh" | "giam-dinh" | "vr-tour";

/** Mọi loại trong hàng đợi gộp: 5 dịch vụ HDCU + đơn "Giao việc cho sàn" (không HDCU). */
export type ServiceRequestKindKey = ServiceKindKey | "truyen-thong";

export interface ServiceKind {
  key: ServiceRequestKindKey;
  label: string;
  /** Mã module quyền admin — GIỮ NGUYÊN, nằm cả trong RLS/RPC. */
  module: string;
  icon: LucideIcon;
}

export const SERVICE_KINDS: readonly ServiceKind[] = [
  { key: "tu-van-phap-ly", label: "Tư vấn pháp lý", module: "tu-van-phap-ly", icon: Scale },
  { key: "tu-van-dau-gia", label: "Tư vấn đấu giá", module: "tu-van-dau-gia", icon: Lightbulb },
  { key: "tham-dinh", label: "Thẩm định giá", module: "tham-dinh-gia", icon: Calculator },
  { key: "giam-dinh", label: "Giám định", module: "don-giam-dinh", icon: BadgeCheck },
  { key: "vr-tour", label: "VR tour", module: "don-vr-tour", icon: Rotate3d },
  // "Giao việc cho sàn" của chủ tài sản (docs/owner-marketing-plan.md Phase M4).
  { key: "truyen-thong", label: "Truyền thông", module: "don-truyen-thong", icon: Megaphone },
];

export const SERVICE_KIND_MODULES = SERVICE_KINDS.map((k) => k.module);

export const serviceKind = (key: ServiceRequestKindKey): ServiceKind => SERVICE_KINDS.find((k) => k.key === key)!;

export const serviceRequestDetailPath = (kind: ServiceRequestKindKey, id: string) =>
  `${ADMIN_SERVICE_REQUESTS_PATH}/${kind}/${id}`;

/** Về danh sách gộp: giữ bộ lọc đang xem nếu có, không thì mở sẵn tab của loại. */
export const serviceRequestListPath = (kind: ServiceRequestKindKey, listSearch?: string) =>
  `${ADMIN_SERVICE_REQUESTS_PATH}${listSearch || `?loai=${kind}`}`;
