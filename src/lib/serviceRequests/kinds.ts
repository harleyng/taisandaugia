// Registry các loại "Yêu cầu dịch vụ" (menu gộp /admin/yeu-cau-dich-vu).
//
// Mỗi loại vẫn giữ BẢNG + RPC + mã quyền riêng — registry chỉ là lớp trình bày chung
// (tab, nhãn, đường dẫn). Thêm dịch vụ mới = thêm 1 dòng ở đây + bộ chuẩn hoá dòng
// trong normalize.ts. Quét 3D chưa có: luồng tự động (credit + webhook), không báo giá.

import { BadgeCheck, Lightbulb, Rotate3d, Scale, type LucideIcon } from "lucide-react";

export const ADMIN_SERVICE_REQUESTS_PATH = "/admin/yeu-cau-dich-vu";

/** Slug = đoạn URL chi tiết, trùng route cũ để link vẫn dễ đọc. */
export type ServiceKindKey = "tu-van-phap-ly" | "tu-van-dau-gia" | "giam-dinh" | "vr-tour";

export interface ServiceKind {
  key: ServiceKindKey;
  label: string;
  /** Mã module quyền admin — GIỮ NGUYÊN, nằm cả trong RLS/RPC. */
  module: string;
  icon: LucideIcon;
}

export const SERVICE_KINDS: readonly ServiceKind[] = [
  { key: "tu-van-phap-ly", label: "Tư vấn pháp lý", module: "tu-van-phap-ly", icon: Scale },
  { key: "tu-van-dau-gia", label: "Tư vấn đấu giá", module: "tu-van-dau-gia", icon: Lightbulb },
  { key: "giam-dinh", label: "Giám định", module: "don-giam-dinh", icon: BadgeCheck },
  { key: "vr-tour", label: "VR tour", module: "don-vr-tour", icon: Rotate3d },
];

export const SERVICE_KIND_MODULES = SERVICE_KINDS.map((k) => k.module);

export const serviceKind = (key: ServiceKindKey): ServiceKind => SERVICE_KINDS.find((k) => k.key === key)!;

export const serviceRequestDetailPath = (kind: ServiceKindKey, id: string) =>
  `${ADMIN_SERVICE_REQUESTS_PATH}/${kind}/${id}`;

/** Về danh sách gộp: giữ bộ lọc đang xem nếu có, không thì mở sẵn tab của loại. */
export const serviceRequestListPath = (kind: ServiceKindKey, listSearch?: string) =>
  `${ADMIN_SERVICE_REQUESTS_PATH}${listSearch || `?loai=${kind}`}`;
