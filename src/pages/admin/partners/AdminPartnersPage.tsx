import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { usePartners, useDeletePartner, useReorderPartner } from "@/hooks/usePartners";
import { PartnerTable } from "@/components/admin/partners/PartnerTable";
import { PartnerFormDialog } from "@/components/admin/partners/PartnerFormDialog";
import type { Partner } from "@/types/partner";

export default function AdminPartnersPage() {
  const { data: partners, isLoading } = usePartners();
  const del = useDeletePartner();
  const reorder = useReorderPartner();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners ?? [];
    return (partners ?? []).filter(
      (p) => p.name.toLowerCase().includes(q) || (p.badge ?? "").toLowerCase().includes(q),
    );
  }, [partners, search]);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: Partner) => { setEditing(p); setDialogOpen(true); };

  const handleReorder = async (ordered: Partner[]) => {
    try {
      await reorder.mutateAsync(ordered);
    } catch {
      toast.error("Đổi thứ tự thất bại");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa đối tác");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Quản lý đối tác</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {partners?.length ?? 0} đối tác · hiển thị ở mục &quot;Đồng hành cùng những thương hiệu…&quot; trên trang chủ
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm đối tác
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Tìm theo tên, nhãn…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      <PartnerTable
        partners={filtered}
        isLoading={isLoading}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onReorder={handleReorder}
        reorderable={!search.trim()}
      />

      <PartnerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        nextOrder={partners?.length ?? 0}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đối tác?</AlertDialogTitle>
            <AlertDialogDescription>
              Đối tác &quot;{deleteTarget?.name}&quot; sẽ bị xóa khỏi trang chủ. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
