import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { GroupFormDialog } from "./GroupFormDialog";
import { useDeleteContactGroup } from "@/hooks/useOrgContactGroups";
import type { OrgContactGroup } from "@/types/org-contacts";

interface Props {
  groups: OrgContactGroup[];
  isLoading: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Bấm vào nhóm ⇒ chuyển sang tab Liên hệ, lọc sẵn theo nhóm. */
  onOpenGroup: (g: OrgContactGroup) => void;
}

export function GroupsSection({ groups, isLoading, canCreate, canEdit, canDelete, onOpenGroup }: Props) {
  const del = useDeleteContactGroup();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgContactGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgContactGroup | null>(null);

  const openForm = (g: OrgContactGroup | null) => {
    setEditing(g);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Nhóm giúp lọc nhanh danh sách gửi khi tiếp thị phiên. Một khách có thể thuộc nhiều nhóm.
        </p>
        {canCreate && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" />
            Tạo nhóm
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">Đang tải nhóm…</Card>
      ) : groups.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-10 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-6 w-6" />
          Chưa có nhóm nào.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Card
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenGroup(g)}
              onKeyDown={(e) => e.key === "Enter" && onOpenGroup(g)}
              className="flex cursor-pointer items-start justify-between gap-2 rounded-2xl p-4 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{g.name}</p>
                <p className="text-sm text-muted-foreground">{g.member_count} khách hàng</p>
                {g.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.description}</p>}
              </div>
              <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Sửa nhóm" onClick={() => openForm(g)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label="Xoá nhóm"
                    onClick={() => setDeleteTarget(g)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <GroupFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Xoá nhóm?"
        description={`Nhóm "${deleteTarget?.name ?? ""}" sẽ bị xoá. Khách hàng trong nhóm vẫn được giữ nguyên.`}
        pending={del.isPending}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) })}
      />
    </div>
  );
}
