import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/OrgContext";
import { useOrgRoles } from "@/hooks/useOrgRoles";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { OrgRolesTable } from "@/components/portal/to-chuc/OrgRolesTable";
import { OrgRoleFormDialog } from "@/components/portal/to-chuc/OrgRoleFormDialog";

export default function OrgRolesPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useOrg();
  const { data: roles, isLoading } = useOrgRoles(currentOrgId);
  const canCreate = useHasOrgPermission("vai-tro", "create");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vai trò</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Mỗi vai trò là một bộ quyền. Gán vai trò cho thành viên ở mục Thành viên.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tạo vai trò
          </Button>
        )}
      </div>

      <OrgRolesTable
        roles={roles ?? []}
        isLoading={isLoading}
        onView={(id) => navigate(`/portal/to-chuc/vai-tro/${id}`)}
      />

      {currentOrgId && (
        <OrgRoleFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          orgId={currentOrgId}
          onCreated={(role) => navigate(`/portal/to-chuc/vai-tro/${role.id}`)}
        />
      )}
    </div>
  );
}
