import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { OwnerRolesTable } from "@/components/asset-owner-portal/roles/OwnerRolesTable";
import { OwnerRoleFormDialog } from "@/components/asset-owner-portal/roles/OwnerRoleFormDialog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerWsRoles } from "@/hooks/useOwnerWsRoles";
import { roleWithinCaller } from "@/lib/ownerWorkspace/roles";
import { OWNER_ROLES_HREF } from "@/components/asset-owner-portal/roles/roleCopy";

/**
 * Vai trò của Trạm Điều Hành — /chu-tai-san/vai-tro. Mỗi vai trò là một bộ quyền
 * module × thao tác (ma trận ở trang chi tiết); gán cho thành viên ở mục Thành viên.
 * Trưởng đơn vị là vai trò hệ thống, luôn toàn quyền. Ghi qua RPC owner_ws_*_role
 * (migration 20260927170100) — DB chặn quyền ghi theo đúng ma trận này.
 */
const OwnerRolesPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, roleId, access, accessVia, can, isLoading: wsLoading } = useOwnerWorkspace();
  const viaHq = accessVia === "hq";
  const rolesQ = useOwnerWsRoles(viaHq ? null : workspaceId);
  const [createOpen, setCreateOpen] = useState(false);

  const roles = useMemo(() => rolesQ.data ?? [], [rolesQ.data]);
  // Sao chép quyền chỉ từ vai trò nằm trong quyền của người tạo (server kiểm lại).
  const copyable = useMemo(() => roles.filter((r) => roleWithinCaller(r, access)), [roles, access]);
  const canCreate = can("vai-tro", "create");

  if (wsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId || !workspace) {
    return (
      <OwnerNoWorkspaceState icon={ShieldCheck}>
        <EmptyState
          icon={ShieldCheck}
          title="Chưa có không gian làm việc"
          description="Vai trò dùng cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  if (viaHq) {
    return (
      <div className="space-y-6">
        <OwnerPageHeader title="Vai trò" subtitle={workspace.primary_name} />
        <EmptyState
          icon={ShieldCheck}
          title="Vai trò do chi nhánh tự quản lý"
          description="Trụ sở xem số liệu của chi nhánh đã liên kết, nhưng không xem hay chỉnh phân quyền trong Trạm của họ."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Vai trò"
        subtitle="Mỗi vai trò là một bộ quyền. Gán vai trò cho thành viên ở mục Thành viên."
        actions={
          canCreate && (
            <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Tạo vai trò
            </Button>
          )
        }
      />

      <SectionCard title={workspace.primary_name} icon={ShieldCheck} count={roles.length}>
        {rolesQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : rolesQ.isError ? (
          <EmptyState
            compact
            tone="destructive"
            icon={ShieldCheck}
            title="Chưa tải được danh sách vai trò."
            action={
              <Button size="sm" variant="outline" onClick={() => void rolesQ.refetch()}>
                Thử lại
              </Button>
            }
          />
        ) : (
          <OwnerRolesTable roles={roles} myRoleId={roleId} onView={(id) => navigate(`${OWNER_ROLES_HREF}/${id}`)} />
        )}
      </SectionCard>

      {canCreate && (
        <OwnerRoleFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceId={workspaceId}
          copyable={copyable}
          onCreated={(id) => navigate(`${OWNER_ROLES_HREF}/${id}`)}
        />
      )}
    </div>
  );
};

export default OwnerRolesPage;
