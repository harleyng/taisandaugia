import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUpsertLead } from "@/hooks/useLeads";
import { STATUS_LABELS, SOURCE_LABELS, LEAD_TYPE_LABELS } from "@/lib/leads/leadStatus";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import type { Lead, LeadStatus, LeadSource, LeadType } from "@/types/leads";
import type { CustomerSegment } from "@/lib/customers/customerSegment";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Lead | null;
}

const NO_PROVINCE = "__none__";

const empty = () => ({
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  company_name: "",
  lead_type: "other" as LeadType,
  source: "other" as LeadSource,
  status: "new" as LeadStatus,
  province: NO_PROVINCE,
  note: "",
});

/** Trạng thái 'converted' cố ý KHÔNG có trong danh sách chọn: nó chỉ do RPC
 *  admin_convert_lead đặt (DB có CHECK ràng hai chiều với converted_customer_id). */
const SELECTABLE: LeadStatus[] = ["new", "contacted", "qualified", "nurturing", "disqualified"];

export function LeadFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertLead();
  const [form, setForm] = useState(empty());

  const isConverted = editing?.status === "converted";

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        contact_name: editing.contact_name ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        company_name: editing.company_name ?? "",
        lead_type: editing.lead_type,
        source: editing.source,
        status: editing.status,
        province: editing.province ?? NO_PROVINCE,
        note: editing.note ?? "",
      });
    } else {
      setForm(empty());
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (form.name.trim().length < 2) return toast.error("Vui lòng nhập tên");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        company_name: form.company_name.trim() || null,
        lead_type: form.lead_type,
        source: form.source,
        // Đã chuyển đổi thì giữ nguyên status — không cho form hạ cấp về 'new'.
        status: isConverted ? "converted" : form.status,
        province: form.province === NO_PROVINCE ? null : form.province,
        note: form.note.trim() || null,
      });
      toast.success(editing ? "Đã cập nhật" : "Đã thêm khách hàng tiềm năng");
      onOpenChange(false);
    } catch {
      toast.error("Lưu thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa khách hàng tiềm năng" : "Thêm khách hàng tiềm năng"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Tên <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Công ty Đấu giá…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Người liên hệ</Label>
              <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Số điện thoại</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0912345678" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Công ty</Label>
              <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={form.lead_type} onValueChange={(v) => set("lead_type", v as LeadType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEAD_TYPE_LABELS) as CustomerSegment[]).map((k) => (
                    <SelectItem key={k} value={k}>{LEAD_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nguồn</Label>
              <Select value={form.source} onValueChange={(v) => set("source", v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((k) => (
                    <SelectItem key={k} value={k}>{SOURCE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select
                value={isConverted ? "converted" : form.status}
                onValueChange={(v) => set("status", v as LeadStatus)}
                disabled={isConverted}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isConverted ? (
                    <SelectItem value="converted">{STATUS_LABELS.converted}</SelectItem>
                  ) : (
                    SELECTABLE.map((k) => (
                      <SelectItem key={k} value={k}>{STATUS_LABELS[k]}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {isConverted && (
                <p className="text-[11px] text-muted-foreground">Đã chuyển đổi — không đổi trạng thái được.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tỉnh/Thành</Label>
              <Select value={form.province} onValueChange={(v) => set("province", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROVINCE}>Không chọn</SelectItem>
                  {vietnamProvinces.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
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
