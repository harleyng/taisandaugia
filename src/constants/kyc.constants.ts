export const KYC_STATUSES = {
  NOT_APPLIED: "Chưa đăng ký",
  PENDING_KYC: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị từ chối",
} as const;

export const USER_ROLES = {
  USER: "Người dùng",
  BROKER: "Môi giới",
  ADMIN: "Quản trị viên",
} as const;
