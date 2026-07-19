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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import { useUpsertService } from "@/hooks/useServices";
import { useSuppliers } from "@/hooks/useSuppliers";
import type { Service, ServiceKind, ServiceAudience } from "@/types/orders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Service | null;
}

const NO_SUPPLIER = "__none__";

const EMPTY = {
  name: "",
  kind: "credit" as ServiceKind,
  category: "package",
  audience: "buyer" as ServiceAudience,
  credit_feature_key: "",
  price: 0,
  description: "",
  sort_order: 0,
  is_active: true,
  supplier_id: NO_SUPPLIER,
};

export function ServiceFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertService();
  const { data: suppliers } = useSuppliers();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        kind: editing.kind,
        category: editing.category ?? "package",
        audience: editing.audience,
        credit_feature_key: editing.credit_feature_key ?? "",
        price: editing.price ?? 0,
        description: editing.description ?? "",
        sort_order: editing.sort_order ?? 0,
        is_active: editing.is_active,
        supplier_id: editing.supplier_id ?? NO_SUPPLIER,
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isCredit = form.kind === "credit";
  const isCommission = form.kind === "commission";

  const submit = async () => {
    if (form.name.trim().length < 2) return toast.error("Vui lòng nhập tên nhóm dịch vụ");
    if (isCommission && form.supplier_id === NO_SUPPLIER)
      return toast.error("Dịch vụ hoa hồng phải chọn nhà cung cấp");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        kind: form.kind,
        // Ràng buộc DB: kind='commission' bắt buộc category='brokerage'.
        category: isCommission ? "brokerage" : form.category.trim() || null,
        audience: form.audience,
        credit_feature_key: isCredit ? form.credit_feature_key.trim() || null : null,
        price: isCredit || isCommission ? 0 : form.price,
        credit_cost: null,
        description: form.description.trim() || null,
        sort_order: form.sort_order,
        is_active: form.is_active,
        supplier_id: isCommission ? form.supplier_id : null,
      });
      toast.success(editing ? "Đã cập nhật nhóm dịch vụ" : "Đã thêm nhóm dịch vụ");
      onOpenChange(false);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      toast.error(
        msg.includes("Không đổi loại dịch vụ")
          ? "Không đổi loại dịch vụ khi đã có đơn hàng"
          : "Thao tác thất bại",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa nhóm dịch vụ" : "Thêm nhóm dịch vụ"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Tên nhóm dịch vụ <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Gói credit Người mua / Theo dõi chủ tài sản" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nguồn</Label>
              {/* Khoá khi sửa: đổi kind sau khi có đơn sẽ làm báo cáo tách nguồn
                  sai hồi tố (đơn giữ snapshot service_kind lúc chốt). */}
              <Select value={form.kind} onValueChange={(v) => set("kind", v as ServiceKind)} disabled={!!editing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="direct">Bán trực tiếp (VND)</SelectItem>
                  <SelectItem value="commission">Hoa hồng (môi giới)</SelectItem>
                </SelectContent>
              </Select>
              {editing && (
                <p className="text-[11px] text-muted-foreground">Không đổi loại dịch vụ sau khi đã có đơn hàng.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Đối tượng</Label>
              <Select value={form.audience} onValueChange={(v) => set("audience", v as ServiceAudience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buyer">Người mua</SelectItem>
                  <SelectItem value="owner">Chủ tài sản</SelectItem>
                  <SelectItem value="company">Công ty đấu giá</SelectItem>
                  <SelectItem value="all">Dùng chung</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại (category)</Label>
              <Select
                value={isCommission ? "brokerage" : form.category}
                onValueChange={(v) => set("category", v)}
                disabled={isCommission}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="package">Gói credit</SelectItem>
                  <SelectItem value="unlock">Tính năng credit (tier)</SelectItem>
                  <SelectItem value="feature">Tính năng theo lượt</SelectItem>
                  <SelectItem value="advertising">Quảng cáo</SelectItem>
                  <SelectItem value="brokerage">Môi giới</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select value={form.is_active ? "1" : "0"} onValueChange={(v) => set("is_active", v === "1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Đang bán</SelectItem>
                  <SelectItem value="0">Ẩn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCommission && (
            <div className="space-y-1.5">
              <Label>Nhà cung cấp <span className="text-destructive">*</span></Label>
              <Select value={form.supplier_id} onValueChange={(v) => set("supplier_id", v)}>
                <SelectTrigger><SelectValue placeholder="Chọn nhà cung cấp" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SUPPLIER}>— Chọn nhà cung cấp —</SelectItem>
                  {(suppliers ?? [])
                    .filter((s) => s.status === "active" || s.id === editing?.supplier_id)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.code ? ` (${s.code})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Bên thực hiện dịch vụ. Tỷ lệ hoa hồng đặt ở từng biến thể.
              </p>
            </div>
          )}

          {isCredit ? (
            <div className="space-y-1.5">
              <Label>Mã tính năng credit (credit_feature_key)</Label>
              <Input
                value={form.credit_feature_key}
                onChange={(e) => set("credit_feature_key", e.target.value)}
                placeholder="unlock_owner / unlock_asset / export_profile…"
              />
              <p className="text-[11px] text-muted-foreground">
                Giá nằm ở BIẾN THỂ (dịch vụ con). Mở rộng nhóm để thêm/sửa biến thể + giá.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Giá (VND)</Label>
                <Input
                  inputMode="numeric"
                  value={groupNumber(form.price)}
                  onChange={(e) => set("price", parseNumber(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Thứ tự</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} />
              </div>
            </div>
          )}

          {isCredit && (
            <div className="space-y-1.5">
              <Label>Thứ tự</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
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
