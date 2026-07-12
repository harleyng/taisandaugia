import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAdminRole, useSetRolePermissions } from "@/hooks/useAdminRoles";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { countMatrix, fullMatrix, TOTAL_PERMISSIONS, type PermissionMatrix } from "@/lib/adminPermissions";
import { PermissionMatrixEditor } from "@/components/admin/quan-tri/PermissionMatrixEditor";
import { RoleFormDialog } from "@/components/admin/quan-tri/RoleFormDialog";
import { DeleteRoleDialog } from "@/components/admin/quan-tri/DeleteRoleDialog";

// Chuẩn hóa để so sánh "dirty" bất kể thứ tự.
const norm = (m: PermissionMatrix) =>
  JSON.stringify(
    Object.entries(m)
      .map(([k, v]) => [k, [...v].sort()] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  );

export default function AdminRoleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useAdminRole(id);
  const canUpdate = useHasAdminPermission("vai-tro", "update");
  const canDelete = useHasAdminPermission("vai-tro", "delete");
  const setPerms = useSetRolePermissions();

  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (data) setMatrix(data.matrix);
  }, [data]);

  const isSuper = data?.role.code === "SUPER_ADMIN";
  const isSystem = data?.role.is_system ?? false;
  const readOnly = isSuper || !canUpdate;

  const dirty = useMemo(() => (data ? norm(matrix) !== norm(data.matrix) : false), [matrix, data]);

  const save = async () => {
    if (!id) return;
    try {
      await setPerms.mutateAsync({ roleId: id, matrix });
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
        onClick={() => navigate("/admin/quan-tri/vai-tro")}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách vai trò
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{role.name}</h1>
            {role.is_system && (
              <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Hệ thống</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono">{role.code}</p>
          {role.description && <p className="text-sm text-muted-foreground mt-1">{role.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {canUpdate && !isSystem && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />Sửa thông tin
            </Button>
          )}
          {canDelete && !isSystem && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />Xóa
            </Button>
          )}
        </div>
      </div>

      {isSuper ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground mb-4">
          Vai trò <strong className="text-foreground">Quản trị tối cao</strong> luôn có toàn quyền và không thể chỉnh sửa ma trận quyền.
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">
            Đã cấp <strong className="text-foreground">{countMatrix(matrix)}</strong>/{TOTAL_PERMISSIONS} quyền
          </p>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={() => setMatrix(data.matrix)}>Hoàn tác</Button>
              )}
              <Button size="sm" onClick={save} disabled={!dirty || setPerms.isPending}>
                {setPerms.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Lưu phân quyền
              </Button>
            </div>
          )}
        </div>
      )}

      <PermissionMatrixEditor
        value={isSuper ? fullMatrix() : matrix}
        onChange={setMatrix}
        disabled={readOnly}
      />

      <RoleFormDialog open={editOpen} onOpenChange={setEditOpen} role={role} />
      <DeleteRoleDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        roleId={role.id}
        roleName={role.name}
        onDeleted={() => navigate("/admin/quan-tri/vai-tro")}
      />
    </div>
  );
}
