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
import { contractErrorMessage, useUpsertContract } from "@/hooks/useSupplierContracts";
import { ContractDocUpload } from "./ContractDocUpload";
import type { ContractStatus, SupplierContract } from "@/types/supplierContract";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SupplierContract | null;
  supplierId: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  contract_no: "",
  title: "",
  signed_date: today(),
  effective_from: today(),
  effective_to: "",
  signer_name: "",
  signer_title: "",
  our_signer_name: "",
  doc_path: null as string | null,
  status: "draft" as ContractStatus,
  note: "",
};

export function ContractFormDialog({ open, onOpenChange, editing, supplierId }: Props) {
  const upsert = useUpsertContract();
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        contract_no: editing.contract_no,
        title: editing.title ?? "",
        signed_date: editing.signed_date,
        effective_from: editing.effective_from,
        effective_to: editing.effective_to ?? "",
        signer_name: editing.signer_name ?? "",
        signer_title: editing.signer_title ?? "",
        our_signer_name: editing.our_signer_name ?? "",
        doc_path: editing.doc_path,
        status: editing.status,
        note: editing.note ?? "",
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.contract_no.trim()) return toast.error("Vui lòng nhập số hợp đồng");
    if (!form.signed_date) return toast.error("Vui lòng chọn ngày ký");
    if (!form.effective_from) return toast.error("Vui lòng chọn ngày bắt đầu hiệu lực");
    if (form.effective_to && form.effective_to < form.effective_from)
      return toast.error("Ngày hết hiệu lực phải sau ngày bắt đầu");

    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        supplier_id: supplierId,
        contract_no: form.contract_no.trim(),
        title: form.title.trim() || null,
        signed_date: form.signed_date,
        effective_from: form.effective_from,
        effective_to: form.effective_to || null,
        signer_name: form.signer_name.trim() || null,
        signer_title: form.signer_title.trim() || null,
        our_signer_name: form.our_signer_name.trim() || null,
        doc_path: form.doc_path,
        status: form.status,
        note: form.note.trim() || null,
      });
      toast.success(editing ? "Đã cập nhật hợp đồng" : "Đã thêm hợp đồng");
      onOpenChange(false);
    } catch (err) {
      // Trigger chống trùng trả về câu tiếng Việt đầy đủ — đừng nuốt nó.
      toast.error(contractErrorMessage(err, "Lưu thất bại"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa hợp đồng" : "Thêm hợp đồng"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Số hợp đồng *</Label>
              <Input
                value={form.contract_no}
                onChange={(e) => set("contract_no", e.target.value)}
                placeholder="12/2026/HĐHT"
              />
            </div>
            <div>
              <Label>Trạng thái</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as ContractStatus)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Nháp</SelectItem>
                  <SelectItem value="active">Đang hiệu lực</SelectItem>
                  <SelectItem value="terminated">Đã chấm dứt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Tên hợp đồng</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Hợp đồng hợp tác môi giới tài sản đấu giá"
              />
            </div>

            <div>
              <Label>Ngày ký *</Label>
              <Input
                type="date"
                value={form.signed_date}
                onChange={(e) => set("signed_date", e.target.value)}
              />
            </div>
            <div />

            <div>
              <Label>Hiệu lực từ *</Label>
              <Input
                type="date"
                value={form.effective_from}
                onChange={(e) => set("effective_from", e.target.value)}
              />
            </div>
            <div>
              <Label>Hiệu lực đến</Label>
              <Input
                type="date"
                value={form.effective_to}
                onChange={(e) => set("effective_to", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Để trống nếu hợp đồng vô thời hạn.
              </p>
            </div>

            <div>
              <Label>Người ký bên đối tác</Label>
              <Input
                value={form.signer_name}
                onChange={(e) => set("signer_name", e.target.value)}
              />
            </div>
            <div>
              <Label>Chức vụ</Label>
              <Input
                value={form.signer_title}
                onChange={(e) => set("signer_title", e.target.value)}
                placeholder="Giám đốc"
              />
            </div>

            <div className="col-span-2">
              <Label>Người ký bên sàn</Label>
              <Input
                value={form.our_signer_name}
                onChange={(e) => set("our_signer_name", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Bản scan hợp đồng</Label>
            <ContractDocUpload
              value={form.doc_path}
              onChange={(p) => set("doc_path", p)}
              supplierId={supplierId}
              contractId={editing?.id}
            />
          </div>

          <div>
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </div>

          <p className="text-xs text-muted-foreground">
            Mức hoa hồng của từng dịch vụ được thêm ở phần &quot;Dịch vụ hợp tác&quot; sau khi
            lưu hợp đồng.
          </p>
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
