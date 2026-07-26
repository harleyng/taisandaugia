import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  useAuctionTools, useToolProviders, useDeleteProvider, isProviderInUseError,
} from "@/hooks/useAuctionTools";
import { ToolProviderTable } from "@/components/admin/auction-tools/ToolProviderTable";
import { ToolProviderFormDialog } from "@/components/admin/auction-tools/ToolProviderFormDialog";
import { ToolContentDialog } from "@/components/admin/auction-tools/ToolContentDialog";
import type { AuctionTool, AuctionToolProvider } from "@/types/auctionTools";

export default function AdminAuctionToolsPage() {
  const { data: tools } = useAuctionTools();
  const { data: providers, isLoading } = useToolProviders();
  const del = useDeleteProvider();

  const [activeTool, setActiveTool] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AuctionToolProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuctionToolProvider | null>(null);
  const [toolEditing, setToolEditing] = useState<AuctionTool | null>(null);

  useEffect(() => {
    if (!activeTool && tools && tools.length > 0) setActiveTool(tools[0].id);
  }, [tools, activeTool]);

  const providersByTool = useMemo(() => {
    const map: Record<string, AuctionToolProvider[]> = {};
    for (const p of providers ?? []) (map[p.tool_id] ??= []).push(p);
    return map;
  }, [providers]);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: AuctionToolProvider) => { setEditing(p); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa đơn vị cung cấp");
    } catch (err) {
      toast.error(
        isProviderInUseError(err)
          ? "Không xóa được: còn cơ hội/đơn hàng tham chiếu — hãy chuyển Tạm ẩn"
          : "Xóa thất bại",
      );
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Công cụ đấu giá</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {tools?.length ?? 0} công cụ · {providers?.length ?? 0} đơn vị cung cấp
          </p>
        </div>
        <Button size="sm" onClick={openAdd} disabled={!activeTool}>
          <Plus className="mr-1.5 h-4 w-4" />
          Thêm đơn vị cung cấp
        </Button>
      </div>

      <Tabs value={activeTool} onValueChange={setActiveTool}>
        <TabsList className="mb-4 flex-wrap">
          {(tools ?? []).map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.name}
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({providersByTool[t.id]?.length ?? 0})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {(tools ?? []).map((t) => (
          <TabsContent key={t.id} value={t.id} className="space-y-3">
            <div className="flex items-start justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.tagline}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setToolEditing(t)}>
                <Pencil className="mr-1.5 h-4 w-4" /> Sửa nội dung
              </Button>
            </div>
            <ToolProviderTable
              providers={providersByTool[t.id] ?? []}
              isLoading={isLoading}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          </TabsContent>
        ))}
      </Tabs>

      <ToolProviderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        tools={tools ?? []}
        defaultToolId={activeTool}
      />

      <ToolContentDialog
        open={!!toolEditing}
        onOpenChange={(o) => !o && setToolEditing(null)}
        tool={toolEditing}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đơn vị cung cấp?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; và toàn bộ showcase của đơn vị này sẽ bị xóa.
              Nếu còn cơ hội/đơn hàng tham chiếu, hãy chuyển sang Tạm ẩn thay vì xóa.
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
