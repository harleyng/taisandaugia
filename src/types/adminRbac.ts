// Kiểu dữ liệu cho module "Quản trị" (RBAC cấp nền tảng).

export interface AdminRole {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

// Vai trò kèm số liệu tổng hợp (dùng cho trang danh sách).
export interface AdminRoleWithMeta extends AdminRole {
  permissionCount: number; // số dòng admin_role_permissions
  assignedCount: number; // số tài khoản đang được gán vai trò này
}

// Một tài khoản quản trị: user có role ADMIN + các vai trò RBAC được gán.
export interface AdminAccount {
  userId: string;
  email: string;
  name: string | null;
  created_at: string;
  lockStatus: "active" | "locked";
  isSuperAdmin: boolean;
  roles: { id: string; name: string; code: string }[];
}

// Một lần gán vai trò cho tài khoản (kèm metadata để hiển thị ở trang chi tiết).
export interface AdminRoleAssignment {
  id: string;
  assigned_at: string;
  role: { id: string; name: string; code: string; description: string | null; is_system: boolean };
}

export interface AdminAccountDetail {
  account: AdminAccount;
  assignments: AdminRoleAssignment[];
}
