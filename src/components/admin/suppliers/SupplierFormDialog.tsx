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
import { useUpsertSupplier } from "@/hooks/useSuppliers";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import type { Supplier, SupplierStatus, SupplierType } from "@/types/supplier";
import type { CommissionType } from "@/types/orders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Supplier | null;
}

const NO_COMMISSION = "__none__";

const EMPTY = {
  name: "",
  supplier_type: "company" as SupplierType,
  contact_name: "",
  phone: "",
  email: "",
  tax_code: "",
  address: "",
  bank_name: "",
  bank_account: "",
  commission_type: NO_COMMISSION as CommissionType | typeof NO_COMMISSION,
  commission_rate: 0,
  note: "",
  status: "active" as SupplierStatus,
};

export function SupplierFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertSupplier();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        supplier_type: editing.supplier_type,
        contact_name: editing.contact_name ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        tax_code: editing.tax_code ?? "",
        address: editing.address ?? "",
        bank_name: editing.bank_name ?? "",
        bank_account: editing.bank_account ?? "",
        commission_type: editing.default_commission_type ?? NO_COMMISSION,
        commission_rate: Number(editing.default_commission_rate ?? 0),
        note: editing.note ?? "",
        status: editing.status,
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isPercent = form.commission_type === "percent";
  const hasCommission = form.commission_type !== NO_COMMISSION;

  const submit = async () => {
    if (form.name.trim().length < 2) return toast.error("Vui lòng nhập tên đối tác");
    if (hasCommission && form.commission_rate <= 0)
      return toast.error("Vui lòng nhập giá trị hoa hồng mặc định");
    if (isPercent && form.commission_rate > 100)
      return toast.error("Tỷ lệ hoa hồng không vượt quá 100%");

    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        supplier_type: form.supplier_type,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        tax_code: form.tax_code.trim() || null,
        address: form.address.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_account: form.bank_account.trim() || null,
        default_commission_type: hasCommission ? (form.commission_type as CommissionType) : null,
        default_commission_rate: hasCommission ? form.commission_rate : null,
        note: form.note.trim() || null,
        status: form.status,
      });
      toast.success(editing ? "Đã cập nhật đối tác" : "Đã thêm đối tác");
      onOpenChange(false);
    } catch {
      toast.error("Lưu thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa đối tác" : "Thêm đối tác"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Tên đối tác *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Công ty CP Thẩm định giá…" />
            </div>

            <div>
              <Label>Loại</Label>
              <Select value={form.supplier_type} onValueChange={(v) => set("supplier_type", v as SupplierType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Công ty</SelectItem>
                  <SelectItem value="individual">Cá nhân</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as SupplierStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Đang hợp tác</SelectItem>
                  <SelectItem value="inactive">Tạm ngưng</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div><Label>Người liên hệ</Label><Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></div>
            <div><Label>Số điện thoại</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0912345678" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div><Label>Mã số thuế</Label><Input value={form.tax_code} onChange={(e) => set("tax_code", e.target.value)} /></div>
            <div className="col-span-2"><Label>Địa chỉ</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div><Label>Ngân hàng</Label><Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} /></div>
            <div><Label>Số tài khoản</Label><Input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} /></div>
          </div>

          {/* Hoa hồng mặc định — CHỈ để form đơn điền sẵn, không phải fallback lúc chạy */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium text-foreground mb-1">Hoa hồng mặc định</p>
            <p className="text-xs text-muted-foreground mb-3">
              Chỉ dùng để gợi ý khi tạo biến thể dịch vụ. Điều khoản thực tế được chốt trên từng đơn hàng.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cách tính</Label>
                <Select
                  value={form.commission_type}
                  onValueChange={(v) => {
                    // Đổi cách tính phải XOÁ giá trị: percent 15 → fixed 15 sẽ thành 15₫
                    // mà mọi ràng buộc đều lọt.
                    setForm((f) => ({ ...f, commission_type: v as CommissionType, commission_rate: 0 }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COMMISSION}>Không đặt mặc định</SelectItem>
                    <SelectItem value="percent">Phần trăm (%)</SelectItem>
                    <SelectItem value="fixed">Số tiền cố định / đơn vị</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasCommission && (
                <div>
                  <Label>{isPercent ? "Tỷ lệ (%)" : "Số tiền (VND)"}</Label>
                  {isPercent ? (
                    // parseNumber strip mọi ký tự không phải chữ số ⇒ 12.5 thành 125.
                    <Input
                      type="number" step="0.01" min="0" max="100"
                      value={form.commission_rate || ""}
                      onChange={(e) => set("commission_rate", Number(e.target.value))}
                      placeholder="12.5"
                    />
                  ) : (
                    <Input
                      inputMode="numeric"
                      value={groupNumber(form.commission_rate)}
                      onChange={(e) => set("commission_rate", parseNumber(e.target.value))}
                      placeholder="3,000,000"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
