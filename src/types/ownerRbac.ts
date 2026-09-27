import type { OwnerPermissionMatrix } from "@/lib/ownerWorkspace/permissions";

/** Một vai trò của Trạm Điều Hành (RPC owner_ws_list_roles). */
export interface OwnerWsRoleRow {
  id: string;
  name: string;
  /** OWNER / STAFF / VIEWER cho vai trò mặc định; CUSTOM_… cho vai trò tự tạo (không hiển thị). */
  code: string;
  description: string | null;
  /** Chỉ Trưởng đơn vị (OWNER) — toàn quyền, không sửa / xoá được. */
  isSystem: boolean;
  matrix: OwnerPermissionMatrix;
  permissionCount: number;
  /** Thành viên đang hoạt động giữ vai trò. */
  memberCount: number;
  /** Lời mời chưa dùng, còn hạn. */
  inviteCount: number;
  createdAt: string;
  updatedAt: string;
}
