import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useServices, useDeleteService } from "@/hooks/useServices";
import { useServiceVariants, useDeleteServiceVariant } from "@/hooks/useServiceVariants";
import { ServiceGroupTable } from "@/components/admin/services/ServiceGroupTable";
import { ServiceFormDialog } from "@/components/admin/services/ServiceFormDialog";
import { ServiceVariantFormDialog } from "@/components/admin/services/ServiceVariantFormDialog";
import type { Service, ServiceGroup, ServiceKind, ServiceAudience, ServiceVariant } from "@/types/orders";

export default function AdminServicesPage() {
  const { data: services, isLoading } = useServices();
  const { data: variants, isLoading: vLoading } = useServiceVariants();
  const delGroup = useDeleteService();
  const delVariant = useDeleteServiceVariant();

  const [kind, setKind] = useState<"all" | ServiceKind>("all");
  const [category, setCategory] = useState<string>("all");
  const [audience, setAudience] = useState<"any" | ServiceAudience>("any");

  const [groupDialog, setGroupDialog] = useState<{ open: boolean; editing: Service | null }>({ open: false, editing: null });
  const [variantDialog, setVariantDialog] = useState<{ open: boolean; group: Service | null; editing: ServiceVariant | null }>({ open: false, group: null, editing: null });
  const [delGroupTarget, setDelGroupTarget] = useState<Service | null>(null);
  const [delVariantTarget, setDelVariantTarget] = useState<ServiceVariant | null>(null);

  const groups: ServiceGroup[] = useMemo(() => {
    const byService = new Map<string, ServiceVariant[]>();
    for (const v of variants ?? []) {
      const arr = byService.get(v.service_id) ?? [];
      arr.push(v);
      byService.set(v.service_id, arr);
    }
    return (services ?? [])
      .map((s) => ({ ...s, variants: (byService.get(s.id) ?? []).sort((a, b) => a.sort_order - b.sort_order) }))
      .filter((g) => {
        if (kind !== "all" && g.kind !== kind) return false;
        if (category !== "all" && g.category !== category) return false;
        if (audience !== "any" && g.audience !== audience) return false;
        return true;
      });
  }, [services, variants, kind, category, audience]);

  const handleDeleteGroup = async () => {
    if (!delGroupTarget) return;
    try {
      await delGroup.mutateAsync(delGroupTarget.id);
      toast.success("Đã xóa nhóm dịch vụ");
    } catch {
      toast.error("Xóa thất bại — có thể nhóm đang được dùng trong đơn hàng");
    }
    setDelGroupTarget(null);
  };

  const handleDeleteVariant = async () => {
    if (!delVariantTarget) return;
    try {
      await delVariant.mutateAsync(delVariantTarget.id);
      toast.success("Đã xóa biến thể");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDelVariantTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dịch vụ</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Danh mục nhóm dịch vụ → biến thể · giá nằm ở biến thể (nguồn giá cho gói credit & chi phí tính năng)
          </p>
        </div>
        <Button size="sm" onClick={() => setGroupDialog({ open: true, editing: null })}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm nhóm dịch vụ
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={kind} onValueChange={(v) => setKind(v as "all" | ServiceKind)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi nguồn</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="direct">Bán trực tiếp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi loại</SelectItem>
            <SelectItem value="package">Gói credit</SelectItem>
            <SelectItem value="unlock">Tính năng credit</SelectItem>
            <SelectItem value="feature">Tính năng theo lượt</SelectItem>
            <SelectItem value="advertising">Quảng cáo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={audience} onValueChange={(v) => setAudience(v as "any" | ServiceAudience)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Mọi đối tượng</SelectItem>
            <SelectItem value="buyer">Người mua</SelectItem>
            <SelectItem value="owner">Chủ tài sản</SelectItem>
            <SelectItem value="company">Công ty đấu giá</SelectItem>
            <SelectItem value="all">Dùng chung</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ServiceGroupTable
        groups={groups}
        isLoading={isLoading || vLoading}
        onEditGroup={(g) => setGroupDialog({ open: true, editing: g })}
        onDeleteGroup={setDelGroupTarget}
        onAddVariant={(g) => setVariantDialog({ open: true, group: g, editing: null })}
        onEditVariant={(g, v) => setVariantDialog({ open: true, group: g, editing: v })}
        onDeleteVariant={setDelVariantTarget}
      />

      <ServiceFormDialog
        open={groupDialog.open}
        onOpenChange={(o) => setGroupDialog((s) => ({ ...s, open: o }))}
        editing={groupDialog.editing}
      />
      {variantDialog.group && (
        <ServiceVariantFormDialog
          open={variantDialog.open}
          onOpenChange={(o) => setVariantDialog((s) => ({ ...s, open: o }))}
          group={variantDialog.group}
          editing={variantDialog.editing}
        />
      )}

      <AlertDialog open={!!delGroupTarget} onOpenChange={(o) => !o && setDelGroupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nhóm dịch vụ?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{delGroupTarget?.name}&quot; và toàn bộ biến thể bên trong sẽ bị xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteGroup}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!delVariantTarget} onOpenChange={(o) => !o && setDelVariantTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa biến thể?</AlertDialogTitle>
            <AlertDialogDescription>
              Biến thể &quot;{delVariantTarget?.name}&quot; sẽ bị xóa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteVariant}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
