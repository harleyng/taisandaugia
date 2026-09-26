import { useMemo } from "react";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { ownerPortalName } from "@/lib/ownerWorkspace/roles";

/**
 * Tên cổng theo Trạm đang chọn (Phase 15a): "Tháp Điều Hành" khi đó là trụ sở có
 * Trạm con đã liên kết mà người dùng đọc được, ngược lại "Trạm Điều Hành".
 */
export function useOwnerPortalName(): string {
  const { workspaceId, memberships } = useOwnerWorkspace();
  return useMemo(() => ownerPortalName(workspaceId, memberships), [workspaceId, memberships]);
}
