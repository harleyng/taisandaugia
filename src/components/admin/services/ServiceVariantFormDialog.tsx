import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import { useUpsertServiceVariant } from "@/hooks/useServiceVariants";
import type { Service, ServiceVariant, CommissionType } from "@/types/orders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Service; // nhóm cha
  editing: ServiceVariant | null;
}

const empty = () => ({
  variant_key: "",
  name: "",
  price: 0,
  base_credits: 0,
  credits: 0,
  credit_cost: 0,
  commission_type: "percent" as CommissionType,
  commission_value: 0,
  is_popular: false,
  is_best: false,
  sort_order: 0,
  is_active: true,
});

export function ServiceVariantFormDialog({ open, onOpenChange, group, editing }: Props) {
  const upsert = useUpsertServiceVariant();
  const [form, setForm] = useState(empty());

  // Thứ tự ưu tiên — không để hai trục cùng true.
  const isCommission = group.kind === "commission";
  const isPackage = !isCommission && group.category === "package";
  const isPercent = form.commission_type === "percent";

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        variant_key: editing.variant_key,
        name: editing.name,
        price: editing.price ?? 0,
        base_credits: editing.base_credits ?? 0,
        credits: editing.credits ?? 0,
        credit_cost: editing.credit_cost ?? 0,
        commission_type: editing.commission_type ?? "percent",
        commission_value: Number(editing.commission_value ?? 0),
        is_popular: editing.is_popular,
        is_best: editing.is_best,
        sort_order: editing.sort_order ?? 0,
        is_active: editing.is_active,
      });
    } else {
      setForm(empty());
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (form.name.trim().length < 1) return toast.error("Nhập tên biến thể");
    if (form.variant_key.trim().length < 2) return toast.error("Nhập variant_key (khóa máy duy nhất)");
    if (isCommission) {
      if (form.commission_value <= 0) return toast.error("Nhập giá trị hoa hồng");
      if (isPercent && form.commission_value > 100)
        return toast.error("Tỷ lệ hoa hồng không vượt quá 100%");
    }
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        service_id: group.id,
        variant_key: form.variant_key.trim(),
        name: form.name.trim(),
        price: isPackage ? form.price : 0,
        base_credits: isPackage ? form.base_credits || null : null,
        credits: isPackage ? form.credits || null : null,
        credit_cost: isPackage || isCommission ? null : form.credit_cost || null,
        commission_type: isCommission ? form.commission_type : null,
        commission_value: isCommission ? form.commission_value : null,
        is_popular: form.is_popular,
        is_best: form.is_best,
        sort_order: form.sort_order,
        is_active: form.is_active,
      });
      toast.success(editing ? "Đã cập nhật biến thể" : "Đã thêm biến thể");
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "";
      toast.error(msg.includes("duplicate") ? "variant_key đã tồn tại" : "Thao tác thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Sửa biến thể" : "Thêm biến thể"} · {group.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tên biến thể <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Nhập Môn / 7 ngày" />
            </div>
            <div className="space-y-1.5">
              <Label>variant_key <span className="text-destructive">*</span></Label>
              <Input
                value={form.variant_key}
                onChange={(e) => set("variant_key", e.target.value)}
                placeholder="buyer_nhap_mon / track_owner_7d"
                disabled={!!editing}
              />
            </div>
          </div>

          {isPackage ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Giá (VND)</Label>
                <Input inputMode="numeric" value={groupNumber(form.price)} onChange={(e) => set("price", parseNumber(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Credit trả tiền</Label>
                <Input inputMode="numeric" value={groupNumber(form.base_credits)} onChange={(e) => set("base_credits", parseNumber(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tổng credit</Label>
                <Input inputMode="numeric" value={groupNumber(form.credits)} onChange={(e) => set("credits", parseNumber(e.target.value))} />
              </div>
            </div>
          ) : isCommission ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cách tính hoa hồng</Label>
                <Select
                  value={form.commission_type}
                  onValueChange={(v) =>
                    // Đổi cách tính phải XOÁ giá trị: percent 15 → fixed 15 sẽ
                    // thành hoa hồng 15₫ mà mọi ràng buộc đều lọt.
                    setForm((f) => ({ ...f, commission_type: v as CommissionType, commission_value: 0 }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Phần trăm (%)</SelectItem>
                    <SelectItem value="fixed">Cố định / đơn vị</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{isPercent ? "Tỷ lệ (%)" : "Hoa hồng cố định / đơn vị (VND)"}</Label>
                {isPercent ? (
                  // KHÔNG dùng parseNumber: nó strip mọi ký tự không phải chữ số
                  // nên 12.5 sẽ thành 125.
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.commission_value || ""}
                    onChange={(e) => set("commission_value", Number(e.target.value))}
                    placeholder="12.5"
                  />
                ) : (
                  <Input
                    inputMode="numeric"
                    value={groupNumber(form.commission_value)}
                    onChange={(e) => set("commission_value", parseNumber(e.target.value))}
                    placeholder="3,000,000"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Chi phí credit (trừ khi dùng)</Label>
              <Input inputMode="numeric" value={groupNumber(form.credit_cost)} onChange={(e) => set("credit_cost", parseNumber(e.target.value))} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Thứ tự</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} />
            </div>
            <div className="flex items-end gap-4 pb-1">
              {isPackage && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.is_popular} onCheckedChange={(v) => set("is_popular", !!v)} /> Phổ biến
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.is_best} onCheckedChange={(v) => set("is_best", !!v)} /> Tốt nhất
                  </label>
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.is_active} onCheckedChange={(v) => set("is_active", !!v)} /> Đang bán
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{editing ? "Lưu" : "Thêm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
