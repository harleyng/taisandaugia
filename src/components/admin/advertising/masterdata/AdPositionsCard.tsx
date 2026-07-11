import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAdPositions, useDeleteAdPosition } from "@/hooks/useAdMasterData";
import { formatVnd } from "@/lib/advertising/slug";
import { AdPositionFormDialog } from "./AdPositionFormDialog";
import type { AdPosition } from "@/types/advertising";

export function AdPositionsCard() {
  const { data: positions, isLoading } = useAdPositions();
  const del = useDeleteAdPosition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdPosition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdPosition | null>(null);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: AdPosition) => { setEditing(p); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa vị trí");
    } catch {
      toast.error("Xóa thất bại — có thể còn banner dùng vị trí này");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Vị trí hiển thị</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{positions?.length ?? 0} vị trí</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm vị trí
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Trang</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Vị trí</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Loại</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Kích thước (D/M)</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Phiên trả giá</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Giá</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-24">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  ))}
                </tr>
              ))
            ) : (
              positions?.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{p.page?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    {p.placement_type === "unique" ? (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Duy nhất</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Slide</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                    {p.desktop_width}×{p.desktop_height} / {p.mobile_width}×{p.mobile_height}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.auction_ends_at ? (
                      <>
                        <span className="text-foreground">{p.bidder_count} người</span>
                        <span className="block text-muted-foreground">
                          KT: {new Date(p.auction_ends_at).toLocaleDateString("vi-VN")}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatVnd(p.price)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {!isLoading && (!positions || positions.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">Chưa có vị trí nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdPositionFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa vị trí?</AlertDialogTitle>
            <AlertDialogDescription>
              Vị trí &quot;{deleteTarget?.name}&quot; sẽ bị xóa. Không thể xóa nếu còn banner đang dùng.
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
