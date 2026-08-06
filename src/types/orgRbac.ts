// Kiểu dữ liệu cho RBAC cấp TỔ CHỨC (portal công ty đấu giá).

export interface OrgRole {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

// Vai trò kèm số liệu tổng hợp (dùng cho trang danh sách).
export interface OrgRoleWithMeta extends OrgRole {
  permissionCount: number; // số dòng org_role_permissions
  memberCount: number; // số thành viên đang mang vai trò này (kể cả lời mời chờ)
}

// Một tổ chức mà user hiện tại là thành viên ACTIVE.
export interface MyOrg {
  id: string;
  name: string;
  kycStatus: string;
  licenseInfo: Record<string, unknown> | null;
  ownerId: string;
  createdAt: string;
  membershipId: string;
  roleId: string;
  roleCode: string;
  roleName: string;
}

/**
 * MỘT dòng trong danh sách thành viên — gộp cả người đã tham gia lẫn lời mời
 * đang chờ, phân biệt bằng `kind` (hiển thị thành cột Trạng thái).
 * Hai bảng tách rời trước đây khiến người dùng phải nhìn hai nơi cho cùng một
 * câu hỏi "ai đang ở trong tổ chức này".
 */
export interface OrgMemberRow {
  membershipId: string;
  kind: "MEMBER" | "INVITE";
  userId: string | null;
  email: string | null; // profiles.email với thành viên, invite_email với lời mời
  name: string | null;
  joinedAt: string | null;
  createdAt: string;
  roleId: string;
  roleName: string;
  roleCode: string;
  // Chỉ có ở lời mời đang chờ:
  token: string | null;
  expiresAt: string | null;
  isExpired: boolean;
}

// Kết quả RPC org_check_invite_email — chỉ boolean, không kèm PII.
export interface InviteEmailStatus {
  exists: boolean;
  activated: boolean;
  locked: boolean;
  already_member: boolean;
  pending_invite: boolean;
}

// Kết quả RPC get_org_invite_preview.
export interface OrgInvitePreview {
  ok: boolean;
  reason?: string;
  org_name?: string;
  role_name?: string;
  invite_email?: string;
  claimed?: boolean;
  expired?: boolean;
}

// Kết quả RPC accept_org_invite.
export interface AcceptInviteResult {
  ok: boolean;
  reason?:
    | "not_authenticated"
    | "not_found"
    | "already_claimed"
    | "expired"
    | "locked"
    | "email_mismatch"
    | "not_activated"
    | "already_member";
  invite_email?: string;
  organization_id?: string;
}
