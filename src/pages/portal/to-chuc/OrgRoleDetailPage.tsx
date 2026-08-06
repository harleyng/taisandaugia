import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useOrg } from "@/contexts/OrgContext";
import { useOrgRole, useOrgRoles, useSetOrgRolePermissions } from "@/hooks/useOrgRoles";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import {
  countOrgMatrix,
  fullOrgMatrix,
  ORG_TOTAL_PERMISSIONS,
  type OrgPermissionMatrix,
} from "@/lib/orgPermissions";
import { OrgPermissionMatrixEditor } from "@/components/portal/to-chuc/OrgPermissionMatrixEditor";
import { OrgRoleFormDialog } from "@/components/portal/to-chuc/OrgRoleFormDialog";
import { DeleteOrgRoleDialog } from "@/components/portal/to-chuc/DeleteOrgRoleDialog";

// Chuẩn hóa để so sánh "dirty" bất kể thứ tự.
const norm = (m: OrgPermissionMatrix) =>
  JSON.stringify(
    Object.entries(m)
      .map(([k, v]) => [k, [...v].sort()] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  );

export default function OrgRoleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrgId } = useOrg();
  const { data, isLoading } = useOrgRole(id);
  const { data: roles } = useOrgRoles(currentOrgId);
  const canUpdate = useHasOrgPermission("vai-tro", "update");
  const canDelete = useHasOrgPermission("vai-tro", "delete");
  const setPerms = useSetOrgRolePermissions();

  const [matrix, setMatrix] = useState<OrgPermissionMatrix>({});
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (data) setMatrix(data.matrix);
  }, [data]);

  const isOwnerRole = data?.role.code === "OWNER";
  const isSystem = data?.role.is_system ?? false;
  const readOnly = isOwnerRole || !canUpdate;
  const memberCount = roles?.find((r) => r.id === id)?.memberCount ?? 0;

  const dirty = useMemo(
    () => (data ? norm(matrix) !== norm(data.matrix) : false),
    [matrix, data],
  );

  const save = async () => {
    if (!id || !currentOrgId) return;
    try {
      await setPerms.mutateAsync({ roleId: id, orgId: currentOrgId, matrix });
      toast.success("Đã lưu phân quyền");
    } catch (err) {
      toast.error("Lưu thất bại", { description: (err as Error).message });
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const { role } = data;

  return (
    <div className="p-6">
      <button
        onClick={() => navigate("/portal/to-chuc/vai-tro")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách vai trò
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{role.name}</h1>
            {role.is_system && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> Hệ thống
              </Badge>
            )}
          </div>
          <p className="mt-0.5 font-mono text-sm text-muted-foreground">{role.code}</p>
          {role.description && (
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canUpdate && !isSystem && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Sửa thông tin
            </Button>
          )}
          {canDelete && !isSystem && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Xóa
            </Button>
          )}
        </div>
      </div>

      {isOwnerRole ? (
        <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Vai trò <strong className="text-foreground">Chủ sở hữu</strong> luôn có toàn quyền
          trong tổ chức và không thể chỉnh sửa ma trận quyền.
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Đã cấp <strong className="text-foreground">{countOrgMatrix(matrix)}</strong>/
            {ORG_TOTAL_PERMISSIONS} quyền
          </p>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={() => setMatrix(data.matrix)}>
                  Hoàn tác
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={!dirty || setPerms.isPending}>
                {setPerms.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Lưu phân quyền
              </Button>
            </div>
          )}
        </div>
      )}

      <OrgPermissionMatrixEditor
        value={isOwnerRole ? fullOrgMatrix() : matrix}
        onChange={setMatrix}
        disabled={readOnly}
      />

      {currentOrgId && (
        <>
          <OrgRoleFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            orgId={currentOrgId}
            role={role}
          />
          <DeleteOrgRoleDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            orgId={currentOrgId}
            roleId={role.id}
            roleName={role.name}
            memberCount={memberCount}
            onDeleted={() => navigate("/portal/to-chuc/vai-tro")}
          />
        </>
      )}
    </div>
  );
}
