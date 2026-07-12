import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
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
import { useCustomers } from "@/hooks/useCustomers";
import { useServices } from "@/hooks/useServices";
import { useAdvertisements } from "@/hooks/useAdvertisements";
import { useUpsertOrder, isDirectServiceError } from "@/hooks/useOrders";
import type { Order, FulfillmentStatus } from "@/types/orders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Order | null;
}

const NONE = "none";

const emptyForm = () => ({
  customer_id: "",
  service_id: "",
  quantity: 1,
  amount: 0,
  fulfillment_status: "pending" as FulfillmentStatus,
  advertisement_id: NONE,
  note: "",
  ordered_at: format(new Date(), "yyyy-MM-dd"),
});

export function OrderFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertOrder();
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const { data: ads } = useAdvertisements();
  const [form, setForm] = useState(emptyForm());

  const directServices = useMemo(
    () => (services ?? []).filter((s) => s.kind === "direct"),
    [services],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        customer_id: editing.customer_id,
        service_id: editing.service_id,
        quantity: editing.quantity,
        amount: editing.amount,
        fulfillment_status: editing.fulfillment_status,
        advertisement_id: editing.advertisement_id ?? NONE,
        note: editing.note ?? "",
        ordered_at: format(new Date(editing.ordered_at), "yyyy-MM-dd"),
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Chọn dịch vụ → gợi ý số tiền theo giá dịch vụ (nếu chưa nhập).
  const onServiceChange = (id: string) => {
    const svc = directServices.find((s) => s.id === id);
    setForm((f) => ({
      ...f,
      service_id: id,
      amount: f.amount > 0 ? f.amount : (svc?.price ?? 0),
    }));
  };

  const submit = async () => {
    if (!form.customer_id) return toast.error("Vui lòng chọn khách hàng");
    if (!form.service_id) return toast.error("Vui lòng chọn dịch vụ");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        customer_id: form.customer_id,
        service_id: form.service_id,
        quantity: form.quantity > 0 ? form.quantity : 1,
        amount: form.amount,
        fulfillment_status: form.fulfillment_status,
        advertisement_id: form.advertisement_id === NONE ? null : form.advertisement_id,
        note: form.note.trim() || null,
        ordered_at: new Date(form.ordered_at).toISOString(),
      });
      toast.success(editing ? "Đã cập nhật đơn hàng" : "Đã tạo đơn hàng");
      onOpenChange(false);
    } catch (err) {
      if (isDirectServiceError(err)) {
        toast.error("Chỉ đặt đơn cho dịch vụ bán trực tiếp (không phải dịch vụ credit)");
      } else {
        toast.error("Thao tác thất bại");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa đơn hàng" : "Tạo đơn hàng"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Khách hàng <span className="text-destructive">*</span></Label>
            <Select value={form.customer_id} onValueChange={(v) => set("customer_id", v)}>
              <SelectTrigger><SelectValue placeholder="Chọn khách hàng" /></SelectTrigger>
              <SelectContent>
                {(customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.code ? ` · ${c.code}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Dịch vụ (bán trực tiếp) <span className="text-destructive">*</span></Label>
            <Select value={form.service_id} onValueChange={onServiceChange}>
              <SelectTrigger><SelectValue placeholder="Chọn dịch vụ" /></SelectTrigger>
              <SelectContent>
                {directServices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {directServices.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Chưa có dịch vụ bán trực tiếp — tạo ở trang Dịch vụ trước.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Số lượng</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => set("quantity", Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Số tiền (VND)</Label>
              <Input
                inputMode="numeric"
                value={groupNumber(form.amount)}
                onChange={(e) => set("amount", parseNumber(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ngày đặt</Label>
              <Input type="date" value={form.ordered_at} onChange={(e) => set("ordered_at", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select value={form.fulfillment_status} onValueChange={(v) => set("fulfillment_status", v as FulfillmentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Chờ xử lý</SelectItem>
                  <SelectItem value="fulfilled">Đã trả quyền lợi</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Liên kết banner quảng cáo (tuỳ chọn)</Label>
            <Select value={form.advertisement_id} onValueChange={(v) => set("advertisement_id", v)}>
              <SelectTrigger><SelectValue placeholder="Không liên kết" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Không liên kết</SelectItem>
                {(ads ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code ? `${a.code} · ` : ""}{a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Khi banner liên kết chuyển sang &quot;Đang hiển thị&quot;, đơn sẽ tự chuyển &quot;Đã trả quyền lợi&quot;.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{editing ? "Lưu" : "Tạo đơn"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
