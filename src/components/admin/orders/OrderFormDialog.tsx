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
import { useServiceVariants } from "@/hooks/useServiceVariants";
import { useAdvertisements } from "@/hooks/useAdvertisements";
import { useUpsertOrder, orderErrorMessage } from "@/hooks/useOrders";
import { OrderCommissionFields, } from "./OrderCommissionFields";
import { previewCommission } from "./commission";
import type { Order, FulfillmentStatus, CommissionType } from "@/types/orders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Order | null;
}

const NONE = "none";

const emptyForm = () => ({
  customer_id: "",
  service_id: "",
  service_variant_id: NONE,
  quantity: 1,
  amount: 0,
  gross_amount: 0,
  commission_type: "percent" as CommissionType,
  commission_value: 0,
  fulfillment_status: "pending" as FulfillmentStatus,
  advertisement_id: NONE,
  note: "",
  ordered_at: format(new Date(), "yyyy-MM-dd"),
});

export function OrderFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertOrder();
  const { data: customers } = useCustomers();
  const { data: services } = useServices();
  const { data: allVariants } = useServiceVariants();
  const { data: ads } = useAdvertisements();
  const [form, setForm] = useState(emptyForm());

  // Đơn credit do trigger sinh từ giao dịch nạp — không tạo tay được.
  const sellableServices = useMemo(
    () => (services ?? []).filter((s) => s.kind !== "credit"),
    [services],
  );

  const selectedService = useMemo(
    () => sellableServices.find((s) => s.id === form.service_id) ?? null,
    [sellableServices, form.service_id],
  );
  const isCommission = selectedService?.kind === "commission";

  const variantsOfService = useMemo(
    () => (allVariants ?? []).filter((v) => v.service_id === form.service_id),
    [allVariants, form.service_id],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        customer_id: editing.customer_id ?? "",
        service_id: editing.service_id,
        service_variant_id: editing.service_variant_id ?? NONE,
        quantity: editing.quantity,
        amount: editing.amount,
        gross_amount: Number(editing.gross_amount ?? 0),
        commission_type: editing.commission_type ?? "percent",
        commission_value: Number(editing.commission_value ?? 0),
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

  // Đổi dịch vụ → reset biến thể và gợi ý số tiền theo giá dịch vụ.
  const onServiceChange = (id: string) => {
    const svc = sellableServices.find((s) => s.id === id);
    setForm((f) => ({
      ...f,
      service_id: id,
      service_variant_id: NONE,
      amount: f.amount > 0 ? f.amount : (svc?.price ?? 0),
    }));
  };

  // Chọn biến thể → lấy điều khoản hoa hồng / giá làm mặc định.
  const onVariantChange = (id: string) => {
    const v = variantsOfService.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      service_variant_id: id,
      commission_type: v?.commission_type ?? f.commission_type,
      commission_value: Number(v?.commission_value ?? f.commission_value),
      amount: !isCommission && v?.price ? Number(v.price) : f.amount,
    }));
  };

  const submit = async () => {
    if (!form.customer_id) return toast.error("Vui lòng chọn khách hàng");
    if (!form.service_id) return toast.error("Vui lòng chọn dịch vụ");
    if (isCommission) {
      if (form.gross_amount <= 0) return toast.error("Vui lòng nhập giá trị hợp đồng");
      if (form.commission_value <= 0) return toast.error("Vui lòng nhập giá trị hoa hồng");
      if (form.commission_type === "percent" && form.commission_value > 100)
        return toast.error("Tỷ lệ hoa hồng không vượt quá 100%");
    }

    // Hoa hồng percent tính trên tổng hợp đồng nên số lượng luôn = 1.
    const quantity = isCommission && form.commission_type === "percent"
      ? 1
      : form.quantity > 0 ? form.quantity : 1;

    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        customer_id: form.customer_id,
        service_id: form.service_id,
        service_variant_id: form.service_variant_id === NONE ? null : form.service_variant_id,
        quantity,
        // Với hoa hồng, trigger tính lại amount — gửi giá trị xem trước cho khớp.
        amount: isCommission
          ? previewCommission(form.commission_type, form.commission_value, form.gross_amount, quantity)
          : form.amount,
        gross_amount: isCommission ? form.gross_amount : form.amount,
        commission_type: isCommission ? form.commission_type : null,
        commission_value: isCommission ? form.commission_value : null,
        fulfillment_status: form.fulfillment_status,
        advertisement_id: form.advertisement_id === NONE ? null : form.advertisement_id,
        note: form.note.trim() || null,
        ordered_at: new Date(form.ordered_at).toISOString(),
      });
      toast.success(editing ? "Đã cập nhật đơn hàng" : "Đã tạo đơn hàng");
      onOpenChange(false);
    } catch (err) {
      toast.error(orderErrorMessage(err) ?? "Thao tác thất bại");
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dịch vụ <span className="text-destructive">*</span></Label>
              <Select value={form.service_id} onValueChange={onServiceChange}>
                <SelectTrigger><SelectValue placeholder="Chọn dịch vụ" /></SelectTrigger>
                <SelectContent>
                  {sellableServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.kind === "commission" ? " · Hoa hồng" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sellableServices.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Chưa có dịch vụ bán được — tạo ở trang Dịch vụ trước.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Biến thể</Label>
              <Select
                value={form.service_variant_id}
                onValueChange={onVariantChange}
                disabled={variantsOfService.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={variantsOfService.length ? "Chọn biến thể" : "Không có biến thể"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Không chọn</SelectItem>
                  {variantsOfService.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCommission ? (
            <OrderCommissionFields
              supplierName={selectedService?.supplier?.name ?? null}
              grossAmount={form.gross_amount}
              commissionType={form.commission_type}
              commissionValue={form.commission_value}
              quantity={form.commission_type === "percent" ? 1 : form.quantity}
              onGrossChange={(v) => set("gross_amount", v)}
              onTypeChange={(v) =>
                // Đổi cách tính phải XOÁ giá trị: percent 15 → fixed 15 = 15₫.
                setForm((f) => ({ ...f, commission_type: v, commission_value: 0 }))
              }
              onValueChange={(v) => set("commission_value", v)}
            />
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            {/* Hoa hồng % tính trên tổng hợp đồng ⇒ số lượng không có nghĩa. */}
            {!(isCommission && form.commission_type === "percent") && (
              <div className="space-y-1.5">
                <Label>Số lượng</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => set("quantity", Number(e.target.value) || 1)}
                />
              </div>
            )}
            {!isCommission && (
              <div className="space-y-1.5 col-span-2">
                <Label>Số tiền (VND)</Label>
                <Input
                  inputMode="numeric"
                  value={groupNumber(form.amount)}
                  onChange={(e) => set("amount", parseNumber(e.target.value))}
                  placeholder="0"
                />
              </div>
            )}
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
