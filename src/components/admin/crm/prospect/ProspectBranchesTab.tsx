import { useMemo, useState } from "react";
import { Building2, FolderPlus, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HelpHint } from "@/components/admin/HelpHint";
import { AssignBranchDialog } from "@/components/admin/crm/prospect/parts/AssignBranchDialog";
import { BranchBulkBar } from "@/components/admin/crm/prospect/parts/BranchBulkBar";
import { BranchTable } from "@/components/admin/crm/prospect/parts/BranchTable";
import { GroupFormDialog } from "@/components/admin/crm/prospect/parts/GroupFormDialog";
import {
  useDeleteProspectGroup, useProspectDetail, useSetProspectGroup, useSetProspectParent,
} from "@/hooks/useProspects";
import { formatVnd } from "@/lib/advertising/slug";
import type { ProspectBranch, ProspectGroup, ProspectKind } from "@/lib/prospects/types";

interface Props {
  kind: ProspectKind;
  prospectId: string;
}

export function ProspectBranchesTab({ kind, prospectId }: Props) {
  const { data, isLoading, isError } = useProspectDetail(kind, prospectId);
  const setParent = useSetProspectParent();
  const setGroup = useSetProspectGroup();
  const delGroup = useDeleteProspectGroup();

  const [assignOpen, setAssignOpen] = useState(false);
  const [groupEditing, setGroupEditing] = useState<ProspectGroup | null>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [detaching, setDetaching] = useState<ProspectBranch | null>(null);
  const [detachManyOpen, setDetachManyOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ProspectGroup | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);

  const branches = useMemo(() => data?.branches ?? [], [data]);
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const busy = setParent.isPending || setGroup.isPending || delGroup.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Không tải được danh sách đơn vị thành viên của khách hàng này.
      </p>
    );
  }

  const totalListings = branches.reduce((s, b) => s + b.listing_count, 0);
  const totalPrice = branches.reduce((s, b) => s + Number(b.starting_price_sum || 0), 0);
  const amcCount = branches.filter((b) => b.is_amc).length;
  const selectedIds = [...selected];

  const clearSelection = () => setSelected(new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const moveToGroup = async (unitIds: string[], groupId: string | null) => {
    if (unitIds.length === 0) return;
    try {
      await setGroup.mutateAsync({ kind, unitIds, groupId });
      toast.success(
        groupId
          ? `Đã xếp ${unitIds.length} đơn vị vào cụm`
          : `Đã đưa ${unitIds.length} đơn vị về chưa xếp cụm`,
      );
      clearSelection();
    } catch {
      toast.error("Xếp cụm thất bại");
    }
  };

  const assignGroup = (groupId: string | null) => moveToGroup(selectedIds, groupId);

  const handleDetach = async () => {
    if (!detaching) return;
    try {
      await setParent.mutateAsync({ kind, childIds: [detaching.id], parentId: null });
      toast.success(`Đã gỡ "${detaching.name}" khỏi đơn vị này`);
    } catch {
      toast.error("Gỡ thất bại");
    }
    setDetaching(null);
  };

  const handleDetachMany = async () => {
    try {
      await setParent.mutateAsync({ kind, childIds: selectedIds, parentId: null });
      toast.success(`Đã gỡ ${selectedIds.length} đơn vị khỏi công ty mẹ`);
      clearSelection();
    } catch {
      toast.error("Gỡ thất bại");
    }
    setDetachManyOpen(false);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await delGroup.mutateAsync(groupToDelete.id);
      toast.success(`Đã xóa cụm "${groupToDelete.name}"`);
    } catch {
      toast.error("Xóa cụm thất bại");
    }
    setGroupToDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Chính đơn vị này lại là chi nhánh của nơi khác — nói ngay để admin
          không nhầm đây là pháp nhân độc lập khi làm báo cáo. */}
      {data.profile.parent && (
        <div className="rounded-2xl border border-border bg-muted/40 px-5 py-4 flex items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-foreground">
            Đơn vị này là đơn vị thành viên của <strong>{data.profile.parent.name}</strong>.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground tabular-nums">{branches.length}</strong> đơn vị thành viên
          <HelpHint side="bottom" label="Cách hoạt động của tab Chi nhánh / AMC">
            <p>
              Quan hệ <strong>Hệ thống suy ra</strong> được dựng từ tên đơn vị (chi nhánh, phòng
              giao dịch, công ty quản lý nợ &amp; khai thác tài sản). Nếu sai, hãy gỡ rồi gán lại.
            </p>
            {groups.length > 0 ? (
              <>
                <p>
                  Kéo tay nắm ở đầu dòng, thả vào cụm khác — dải tiêu đề hoặc bất kỳ dòng nào
                  trong cụm đó.
                </p>
                <p>Kéo một dòng đang được chọn sẽ chuyển cả nhóm đang chọn.</p>
                <p>Xóa cụm không làm mất chi nhánh: chúng quay về &quot;Chưa xếp cụm&quot;.</p>
              </>
            ) : (
              <p>
                Tạo một cụm (VD &quot;Cụm miền Bắc&quot;) để gom nhóm chi nhánh, sau đó kéo thả
                xếp lại cho nhanh.
              </p>
            )}
          </HelpHint>
          {groups.length > 0 && <> · {groups.length} cụm</>}
          {amcCount > 0 && <> · {amcCount} công ty AMC</>}
          {branches.length > 0 && (
            <>
              {" · "}
              <strong className="text-foreground tabular-nums">{totalListings}</strong> tài sản
              {" · "}
              {formatVnd(totalPrice)}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setGroupEditing(null); setGroupFormOpen(true); }}
          >
            <FolderPlus className="h-4 w-4 mr-1.5" />
            Tạo cụm
          </Button>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm đơn vị thành viên
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <BranchBulkBar
          count={selected.size}
          groups={groups}
          busy={busy}
          onClear={clearSelection}
          onAssignGroup={assignGroup}
          onCreateGroup={() => { setGroupEditing(null); setGroupFormOpen(true); }}
          onDetachAll={() => setDetachManyOpen(true)}
        />
      )}

      <BranchTable
        branches={branches}
        groups={groups}
        selected={selected}
        onToggle={toggleOne}
        onToggleMany={toggleMany}
        onDetach={setDetaching}
        onRenameGroup={(g) => { setGroupEditing(g); setGroupFormOpen(true); }}
        onDeleteGroup={setGroupToDelete}
        onMoveToGroup={moveToGroup}
        grouping={groups.length > 0}
        activeDragId={dragId}
        onDragStateChange={setDragId}
      />


      <AssignBranchDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        kind={kind}
        parentId={prospectId}
        parentName={data.profile.name}
        existingIds={branches.map((b) => b.id)}
      />

      <GroupFormDialog
        open={groupFormOpen}
        onOpenChange={setGroupFormOpen}
        kind={kind}
        parentId={prospectId}
        editing={groupEditing}
        // Tạo cụm ngay trong lúc đang chọn dòng thì xếp luôn — nếu không, admin
        // phải mở lại menu và chọn cụm vừa tạo.
        onCreated={(id) => { if (selectedIds.length > 0) assignGroup(id); }}
      />

      <AlertDialog open={!!detaching} onOpenChange={(o) => !o && setDetaching(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ khỏi đơn vị thành viên?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{detaching?.name}&quot; sẽ không còn thuộc {data.profile.name}. Bản ghi và tài
              sản của đơn vị này vẫn giữ nguyên, chỉ quan hệ trực thuộc bị gỡ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDetach}>Gỡ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={detachManyOpen} onOpenChange={setDetachManyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ {selected.size} đơn vị khỏi công ty mẹ?</AlertDialogTitle>
            <AlertDialogDescription>
              Các đơn vị này sẽ không còn thuộc {data.profile.name} và cũng rời khỏi cụm đang
              xếp. Bản ghi và tài sản của chúng vẫn giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDetachMany}>Gỡ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!groupToDelete} onOpenChange={(o) => !o && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa cụm &quot;{groupToDelete?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              {groupToDelete?.unit_count ?? 0} đơn vị trong cụm sẽ quay về &quot;Chưa xếp
              cụm&quot;. Không đơn vị nào bị gỡ khỏi {data.profile.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteGroup}
            >
              Xóa cụm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
