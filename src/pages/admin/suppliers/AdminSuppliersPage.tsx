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
import { useSuppliers, useDeleteSupplier, isSupplierInUseError } from "@/hooks/useSuppliers";
import { useServices } from "@/hooks/useServices";
import { usePartners } from "@/hooks/usePartners";
import { SupplierTable } from "@/components/admin/suppliers/SupplierTable";
import { SupplierFormDialog } from "@/components/admin/suppliers/SupplierFormDialog";
import type { Supplier } from "@/types/supplier";

export default function AdminSuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const { data: services } = useServices();
  const { data: partners } = usePartners();
  const del = useDeleteSupplier();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  // Số dịch vụ đang trỏ vào mỗi NCC — dùng để chặn xoá trước khi lòi lỗi FK thô.
  const usageById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of services ?? []) {
      if (s.supplier_id) map[s.supplier_id] = (map[s.supplier_id] ?? 0) + 1;
    }
    return map;
  }, [services]);

  // Quyết định hiển thị nằm ở module "Đối tác trên sàn" (Nội dung) — ở đây chỉ đọc.
  const shownOnMarketplace = useMemo(
    () => new Set((partners ?? []).filter((p) => p.supplier_id).map((p) => p.supplier_id as string)),
    [partners],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers ?? [];
    return (suppliers ?? []).filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.contact_name ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q) ||
        (s.tax_code ?? "").includes(q),
    );
  }, [suppliers, search]);

  const supplierCount = useMemo(
    () => (services ?? []).filter((s) => s.kind === "commission").length,
    [services],
  );

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa đối tác");
    } catch (err) {
      toast.error(
        isSupplierInUseError(err)
          ? "Không xóa được: còn dịch vụ hoặc thẻ hiển thị đang dùng đối tác này"
          : "Xóa thất bại",
      );
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Đối tác</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {suppliers?.length ?? 0} đối tác · {shownOnMarketplace.size} hiển thị trên sàn ·{" "}
            {supplierCount} dịch vụ hoa hồng
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm đối tác
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên, mã, người liên hệ, SĐT, MST…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <SupplierTable
        suppliers={filtered}
        isLoading={isLoading}
        usageById={usageById}
        shownOnMarketplace={shownOnMarketplace}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <SupplierFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đối tác?</AlertDialogTitle>
            <AlertDialogDescription>
              Đối tác &quot;{deleteTarget?.name}&quot; sẽ bị xóa. Nếu còn dịch vụ hoặc thẻ hiển thị
              đang tham chiếu, hãy chuyển sang trạng thái Tạm ngưng thay vì xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
