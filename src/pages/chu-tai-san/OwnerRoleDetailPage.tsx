import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerPermissionMatrixEditor } from "@/components/asset-owner-portal/roles/OwnerPermissionMatrixEditor";
import { OwnerRoleFormDialog } from "@/components/asset-owner-portal/roles/OwnerRoleFormDialog";
import { DeleteOwnerRoleDialog } from "@/components/asset-owner-portal/roles/DeleteOwnerRoleDialog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerWsRoles, useSetOwnerWsRolePermissions } from "@/hooks/useOwnerWsRoles";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import { roleWithinCaller } from "@/lib/ownerWorkspace/roles";
import {
  countOwnerMatrix,
  fullOwnerMatrix,
  OWNER_TOTAL_PERMISSIONS,
  type OwnerPermissionMatrix,
} from "@/lib/ownerWorkspace/permissions";
import { OWNER_ROLES_HREF } from "@/components/asset-owner-portal/roles/roleCopy";

// Chuẩn hoá để so sánh "đã sửa" bất kể thứ tự.
const norm = (m: OwnerPermissionMatrix) =>
  JSON.stringify(
    Object.entries(m)
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => [k, [...v].sort()] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  );

/** Giữ lại đúng các quyền người sửa đang có — không cấp được quyền mình không có. */
const clampTo = (next: OwnerPermissionMatrix, allowed: OwnerPermissionMatrix): OwnerPermissionMatrix =>
  Object.fromEntries(
    Object.entries(next)
      .map(([module, actions]) => [module, actions.filter((a) => allowed[module]?.includes(a))] as const)
      .filter(([, actions]) => actions.length > 0),
  );

/**
 * Chi tiết một vai trò — /chu-tai-san/vai-tro/:id: ma trận quyền module × thao tác.
 * Chỉ đọc khi: vai trò Trưởng đơn vị; không có quyền vai-tro:update; hoặc (với người
 * không phải Trưởng đơn vị) đó là vai trò của chính mình / vai trò có quyền mình không có.
 */
const OwnerRoleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspaceId, roleId: myRoleId, isOwner, access, accessVia, can, isLoading: wsLoading } = useOwnerWorkspace();
  const rolesQ = useOwnerWsRoles(accessVia === "hq" ? null : workspaceId);
  const setPerms = useSetOwnerWsRolePermissions(workspaceId);
  const role = useMemo(() => rolesQ.data?.find((r) => r.id === id) ?? null, [rolesQ.data, id]);

  const [matrix, setMatrix] = useState<OwnerPermissionMatrix>({});
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Nạp lại khi vai trò đổi thật (lưu xong / đổi vai trò) — không đè thao tác đang dở khi refetch.
  const roleVersion = role ? `${role.id}|${role.updatedAt}` : "";
  useEffect(() => {
    if (role) setMatrix(role.matrix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleVersion]);

  const back = (
    <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => navigate(OWNER_ROLES_HREF)}>
      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
      Danh sách vai trò
    </Button>
  );

  if (wsLoading || rolesQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!role || !workspaceId) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={ShieldCheck}
          title="Không tìm thấy vai trò"
          description="Vai trò có thể đã bị xoá, hoặc thuộc một không gian khác với không gian đang chọn."
        />
      </div>
    );
  }

  const isMine = role.id === myRoleId;
  const within = roleWithinCaller(role, access);
  const editable = !role.isSystem && (isOwner || (!isMine && within));
  const canUpdate = can("vai-tro", "update") && editable;
  const canDelete = can("vai-tro", "delete") && editable;
  const dirty = norm(matrix) !== norm(role.matrix);

  const lockNote = role.isSystem
    ? "Trưởng đơn vị luôn có toàn quyền trong đơn vị và không bao giờ bị giới hạn chi nhánh — không chỉnh được ma trận."
    : !can("vai-tro", "update")
      ? "Vai trò của bạn chỉ được xem phân quyền."
      : !isOwner && isMine
        ? "Bạn không tự chỉnh được vai trò mình đang giữ — nhờ Trưởng đơn vị."
        : !isOwner && !within
          ? "Vai trò này có quyền mà bạn không có, nên bạn không chỉnh được."
          : null;

  const save = async () => {
    try {
      await setPerms.mutateAsync({ roleId: role.id, matrix });
      toast.success("Đã lưu phân quyền");
    } catch (err) {
      toast.error("Chưa lưu được", { description: ownerWsErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      {back}

      <OwnerPageHeader
        title={role.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {role.isSystem && (
              <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 font-normal text-primary">
                <ShieldCheck className="h-3 w-3" strokeWidth={1.5} /> Hệ thống
              </Badge>
            )}
            <span>
              {role.memberCount} thành viên{role.inviteCount > 0 ? ` · ${role.inviteCount} lời mời` : ""}
              {role.description ? ` · ${role.description}` : ""}
            </span>
          </span>
        }
        actions={
          <>
            {canUpdate && (
              <Button variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" strokeWidth={1.5} />
                Sửa thông tin
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                Xoá
              </Button>
            )}
          </>
        }
      />

      <SectionCard
        title="Phân quyền"
        icon={ShieldCheck}
        actions={
          canUpdate ? (
            <div className="flex items-center gap-2">
              {dirty && (
                <Button variant="ghost" size="sm" onClick={() => setMatrix(role.matrix)} disabled={setPerms.isPending}>
                  Hoàn tác
                </Button>
              )}
              <Button size="sm" onClick={() => void save()} disabled={!dirty || setPerms.isPending}>
                {setPerms.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Lưu phân quyền
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="mb-4 space-y-2 text-sm text-muted-foreground">
          <p>
            Đã cấp{" "}
            <strong className="text-foreground">
              {role.isSystem ? OWNER_TOTAL_PERMISSIONS : countOwnerMatrix(matrix)}
            </strong>
            /{OWNER_TOTAL_PERMISSIONS} quyền. Quyền ghi được hệ thống chặn đúng theo ma trận; “Xem” quyết định mục
            nào hiện trên menu. Phạm vi chi nhánh đặt riêng cho từng thành viên.
          </p>
          {lockNote ? (
            <p className="rounded-xl bg-muted/60 px-3 py-2">{lockNote}</p>
          ) : (
            !isOwner && <p className="rounded-xl bg-muted/60 px-3 py-2">Bạn chỉ cấp được những quyền vai trò của bạn đang có.</p>
          )}
        </div>
        <OwnerPermissionMatrixEditor
          value={role.isSystem ? fullOwnerMatrix() : matrix}
          onChange={(next) => setMatrix(isOwner ? next : clampTo(next, access?.matrix ?? {}))}
          disabled={!canUpdate}
        />
      </SectionCard>

      {canUpdate && <OwnerRoleFormDialog open={editOpen} onOpenChange={setEditOpen} workspaceId={workspaceId} role={role} />}
      {canDelete && (
        <DeleteOwnerRoleDialog
          role={deleteOpen ? role : null}
          onClose={() => setDeleteOpen(false)}
          workspaceId={workspaceId}
          onDeleted={() => navigate(OWNER_ROLES_HREF, { replace: true })}
        />
      )}
    </div>
  );
};

export default OwnerRoleDetailPage;
