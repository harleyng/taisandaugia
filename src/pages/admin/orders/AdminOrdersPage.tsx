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
import { useOrders, useDeleteOrder } from "@/hooks/useOrders";
import { OrderTable } from "@/components/admin/orders/OrderTable";
import { OrderFormDialog } from "@/components/admin/orders/OrderFormDialog";
import type { Order, FulfillmentStatus } from "@/types/orders";

type StatusFilter = "all" | FulfillmentStatus;

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ xử lý" },
  { key: "fulfilled", label: "Đã trả quyền lợi" },
  { key: "cancelled", label: "Đã hủy" },
];

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
    active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground",
  ].join(" ");

export default function AdminOrdersPage() {
  const { data: orders, isLoading } = useOrders();
  const del = useDeleteOrder();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  const counts = useMemo(() => {
    const list = orders ?? [];
    return {
      all: list.length,
      pending: list.filter((o) => o.fulfillment_status === "pending").length,
      fulfilled: list.filter((o) => o.fulfillment_status === "fulfilled").length,
      cancelled: list.filter((o) => o.fulfillment_status === "cancelled").length,
    } as Record<StatusFilter, number>;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders ?? []).filter((o) => {
      if (status !== "all" && o.fulfillment_status !== status) return false;
      if (!q) return true;
      return (
        (o.code ?? "").toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        (o.service?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders, search, status]);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (o: Order) => { setEditing(o); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa đơn hàng");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Đơn hàng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Đơn dịch vụ bán trực tiếp của khách hàng · quảng cáo tự trả quyền lợi khi banner chạy
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo đơn hàng
        </Button>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setStatus(t.key)} className={pill(status === t.key)}>
              {t.label} ({counts[t.key] ?? 0})
            </button>
          ))}
        </div>
        <div className="relative max-w-sm w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm theo mã, khách hàng, dịch vụ…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      <OrderTable orders={filtered} isLoading={isLoading} onEdit={openEdit} onDelete={setDeleteTarget} />

      <OrderFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đơn hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              Đơn hàng &quot;{deleteTarget?.code}&quot; sẽ bị xóa vĩnh viễn.
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
