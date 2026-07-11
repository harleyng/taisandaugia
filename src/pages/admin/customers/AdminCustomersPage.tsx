import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useCustomers, useDeleteCustomer } from "@/hooks/useCustomers";
import { CustomerTable } from "@/components/admin/customers/CustomerTable";
import { CustomerFormDialog } from "@/components/admin/customers/CustomerFormDialog";
import type { Customer } from "@/types/advertising";

export default function AdminCustomersPage() {
  const navigate = useNavigate();
  const { data: customers, isLoading } = useCustomers();
  const del = useDeleteCustomer();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers ?? [];
    return (customers ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa khách hàng");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Khách hàng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {customers?.length ?? 0} khách hàng · dùng chung cho các dịch vụ
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm khách hàng
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Tìm theo tên, mã, SĐT, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      <CustomerTable
        customers={filtered}
        isLoading={isLoading}
        onView={(c) => navigate(`/admin/khach-hang/${c.id}`)}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <CustomerFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              Khách hàng &quot;{deleteTarget?.name}&quot; sẽ bị xóa. Banner đang gắn khách hàng này sẽ được gỡ liên kết.
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
