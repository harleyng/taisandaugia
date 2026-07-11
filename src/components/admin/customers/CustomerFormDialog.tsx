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
import { useUpsertCustomer } from "@/hooks/useCustomers";
import type { Customer, CustomerStatus, CustomerType } from "@/types/advertising";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Customer | null;
}

const EMPTY = {
  name: "",
  customer_type: "company" as CustomerType,
  contact_name: "",
  phone: "",
  email: "",
  tax_code: "",
  address: "",
  note: "",
  status: "active" as CustomerStatus,
};

export function CustomerFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertCustomer();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        customer_type: editing.customer_type,
        contact_name: editing.contact_name ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        tax_code: editing.tax_code ?? "",
        address: editing.address ?? "",
        note: editing.note ?? "",
        status: editing.status,
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (form.name.trim().length < 2) return toast.error("Vui lòng nhập tên khách hàng");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        customer_type: form.customer_type,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        tax_code: form.tax_code.trim() || null,
        address: form.address.trim() || null,
        note: form.note.trim() || null,
        status: form.status,
      });
      toast.success(editing ? "Đã cập nhật khách hàng" : "Đã thêm khách hàng");
      onOpenChange(false);
    } catch {
      toast.error("Thao tác thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Tên khách hàng <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Tên cá nhân / công ty" />
            </div>
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={form.customer_type} onValueChange={(v) => set("customer_type", v as CustomerType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Công ty</SelectItem>
                  <SelectItem value="individual">Cá nhân</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as CustomerStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Đang hoạt động</SelectItem>
                  <SelectItem value="inactive">Ngừng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Người liên hệ</Label>
              <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mã số thuế</Label>
              <Input value={form.tax_code} onChange={(e) => set("tax_code", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Địa chỉ</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
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
