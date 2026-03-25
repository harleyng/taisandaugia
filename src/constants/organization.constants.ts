export const ORG_KYC_STATUSES = {
  NOT_APPLIED: "Chưa đăng ký",
  PENDING_KYC: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
} as const;

export const MEMBERSHIP_STATUSES = {
  PENDING_INVITE: "Chờ xác nhận",
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
} as const;

export const ORG_ROLE_NAMES = {
  Owner: "Chủ sở hữu",
  Manager: "Quản lý",
  Agent: "Môi giới",
} as const;

export const ORG_PERMISSIONS = {
  ALL_PERMISSIONS: "Toàn quyền",
  CAN_POST_LISTING: "Đăng tin",
  CAN_INVITE_AGENT: "Mời môi giới",
  CAN_REMOVE_AGENT: "Xóa môi giới",
  CAN_MANAGE_LISTINGS: "Quản lý tin đăng",
  CAN_VIEW_ANALYTICS: "Xem thống kê",
  CAN_VIEW_OWN_LISTINGS: "Xem tin của mình",
} as const;
