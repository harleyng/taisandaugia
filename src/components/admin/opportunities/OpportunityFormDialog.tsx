import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
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
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import { useServices } from "@/hooks/useServices";
import { useServiceVariants } from "@/hooks/useServiceVariants";
import { useCustomers } from "@/hooks/useCustomers";
import { useLeads } from "@/hooks/useLeads";
import { useUpsertOpportunity, opportunityErrorMessage } from "@/hooks/useOpportunities";
import { TYPE_LABELS } from "@/lib/opportunities/opportunityStage";
import type { Opportunity, OpportunityType } from "@/types/opportunities";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Opportunity | null;
}

const NONE = "__none__";

const empty = () => ({
  name: "",
  owner: "" as string,          // "lead:<id>" | "cus:<id>" — xor 1-trong-2
  opportunity_type: "new_business" as OpportunityType,
  service_id: "",
  service_variant_id: NONE,
  amount: 0,
  gross_amount: 0,
  expected_close_at: format(new Date(Date.now() + 14 * 86400000), "yyyy-MM-dd"),
  note: "",
});

export function OpportunityFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertOpportunity();
  const { data: services } = useServices();
  const { data: variants } = useServiceVariants();
  const { data: customers } = useCustomers();
  const { data: leads } = useLeads();
  const [form, setForm] = useState(empty());

  const sellable = useMemo(() => (services ?? []).filter((s) => s.is_active), [services]);
  const selected = useMemo(
    () => sellable.find((s) => s.id === form.service_id) ?? null,
    [sellable, form.service_id],
  );
  const isCommission = selected?.kind === "commission";

  const variantsOf = useMemo(
    () => (variants ?? []).filter((v) => v.service_id === form.service_id),
    [variants, form.service_id],
  );

  // Lead đã chuyển đổi thì không gắn cơ hội mới vào nữa — chọn khách hàng.
  const openLeads = useMemo(
    () => (leads ?? []).filter((l) => l.status !== "converted" && l.status !== "disqualified"),
    [leads],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        owner: editing.lead_id ? `lead:${editing.lead_id}` : `cus:${editing.customer_id}`,
        opportunity_type: editing.opportunity_type,
        service_id: editing.service_id,
        service_variant_id: editing.service_variant_id ?? NONE,
        amount: Number(editing.amount ?? 0),
        gross_amount: Number(editing.gross_amount ?? 0),
        expected_close_at: editing.expected_close_at
          ? format(new Date(editing.expected_close_at), "yyyy-MM-dd")
          : "",
        note: editing.note ?? "",
      });
    } else {
      setForm(empty());
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onVariantChange = (id: string) => {
    const v = variantsOf.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      service_variant_id: id,
      amount: !isCommission && v?.price ? Number(v.price) : f.amount,
    }));
  };

  const submit = async () => {
    if (form.name.trim().length < 2) return toast.error("Vui lòng nhập tên cơ hội");
    if (!form.owner) return toast.error("Vui lòng chọn khách hàng hoặc khách tiềm năng");
    if (!form.service_id) return toast.error("Vui lòng chọn dịch vụ");

    const [kind, id] = form.owner.split(":");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        // Đúng một trong hai (CHECK num_nonnulls = 1 ở DB).
        lead_id: kind === "lead" ? id : null,
        customer_id: kind === "cus" ? id : null,
        opportunity_type: form.opportunity_type,
        service_id: form.service_id,
        service_variant_id: form.service_variant_id === NONE ? null : form.service_variant_id,
        amount: form.amount,
        gross_amount: isCommission ? form.gross_amount : form.amount,
        expected_close_at: form.expected_close_at
          ? new Date(form.expected_close_at).toISOString()
          : null,
        note: form.note.trim() || null,
      });
      toast.success(editing ? "Đã cập nhật cơ hội" : "Đã tạo cơ hội");
      onOpenChange(false);
    } catch (err) {
      toast.error(opportunityErrorMessage(err) ?? "Thao tác thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa cơ hội" : "Tạo cơ hội"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Tên cơ hội <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Hợp đồng mới" />
          </div>

          <div className="space-y-1.5">
            <Label>Khách hàng / Khách tiềm năng <span className="text-destructive">*</span></Label>
            <Select value={form.owner} onValueChange={(v) => set("owner", v)}>
              <SelectTrigger><SelectValue placeholder="Chọn chủ thể" /></SelectTrigger>
              <SelectContent>
                {(customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={`cus:${c.id}`}>
                    {c.name}{c.code ? ` · ${c.code}` : ""}
                  </SelectItem>
                ))}
                {openLeads.map((l) => (
                  <SelectItem key={l.id} value={`lead:${l.id}`}>
                    {l.name} · {l.code} (tiềm năng)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại cơ hội</Label>
              <Select value={form.opportunity_type} onValueChange={(v) => set("opportunity_type", v as OpportunityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as OpportunityType[]).map((k) => (
                    <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dự kiến chốt</Label>
              <Input type="date" value={form.expected_close_at} onChange={(e) => set("expected_close_at", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dịch vụ <span className="text-destructive">*</span></Label>
              <Select value={form.service_id} onValueChange={(v) => setForm((f) => ({ ...f, service_id: v, service_variant_id: NONE }))}>
                <SelectTrigger><SelectValue placeholder="Chọn dịch vụ" /></SelectTrigger>
                <SelectContent>
                  {sellable.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Biến thể</Label>
              <Select value={form.service_variant_id} onValueChange={onVariantChange} disabled={variantsOf.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={variantsOf.length ? "Chọn" : "Không có"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Không chọn</SelectItem>
                  {variantsOf.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCommission && (
            <div className="space-y-1.5">
              <Label>Giá trị hợp đồng dự kiến (VND)</Label>
              <Input
                inputMode="numeric"
                value={groupNumber(form.gross_amount)}
                onChange={(e) => set("gross_amount", parseNumber(e.target.value))}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{isCommission ? "Hoa hồng dự kiến (VND)" : "Giá trị dự kiến (VND)"}</Label>
            <Input
              inputMode="numeric"
              value={groupNumber(form.amount)}
              onChange={(e) => set("amount", parseNumber(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{editing ? "Lưu" : "Tạo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
