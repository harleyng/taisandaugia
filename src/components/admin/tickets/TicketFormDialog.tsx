import { useEffect, useState } from "react";
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
import { useUpsertTicket } from "@/hooks/useTickets";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { STATUS_LABELS, SOURCE_LABELS, PRIORITY_LABELS } from "@/lib/tickets/ticketStatus";
import { resolveRelation, RELATION_LABELS } from "@/lib/crm/relation";
import type { CrmRelation } from "@/lib/crm/relation";
import type { Ticket, TicketStatus, TicketSource, TicketPriority } from "@/types/tickets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Ticket | null;
  defaultRelation?: Partial<CrmRelation>;
}

const NO_ASSIGNEE = "__none__";

const empty = () => ({
  subject: "",
  body: "",
  source: "manual" as TicketSource,
  status: "new" as TicketStatus,
  priority: "normal" as TicketPriority,
  requester_name: "",
  requester_phone: "",
  requester_email: "",
  assignee_id: NO_ASSIGNEE,
  resolution_note: "",
});

export function TicketFormDialog({ open, onOpenChange, editing, defaultRelation }: Props) {
  const upsert = useUpsertTicket();
  const { data: admins } = useAdminUsers();
  const [form, setForm] = useState(empty());

  // Ticket đến từ form công khai: nguồn là dữ kiện, không cho sửa.
  const fromForm = !!editing && (editing.source === "contact_form" || editing.source === "partnership");
  const rel = editing ? resolveRelation(editing) : null;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        subject: editing.subject,
        body: editing.body ?? "",
        source: editing.source,
        status: editing.status,
        priority: editing.priority,
        requester_name: editing.requester_name ?? "",
        requester_phone: editing.requester_phone ?? "",
        requester_email: editing.requester_email ?? "",
        assignee_id: editing.assignee_id ?? NO_ASSIGNEE,
        resolution_note: editing.resolution_note ?? "",
      });
    } else {
      setForm(empty());
    }
  }, [open, editing]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (form.subject.trim().length < 2) return toast.error("Vui lòng nhập tiêu đề");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : defaultRelation ?? {}),
        subject: form.subject.trim(),
        body: form.body.trim() || null,
        source: form.source,
        status: form.status,
        priority: form.priority,
        requester_name: form.requester_name.trim() || null,
        requester_phone: form.requester_phone.trim() || null,
        requester_email: form.requester_email.trim() || null,
        assignee_id: form.assignee_id === NO_ASSIGNEE ? null : form.assignee_id,
        resolution_note: form.resolution_note.trim() || null,
      });
      toast.success(editing ? "Đã cập nhật ticket" : "Đã tạo ticket");
      onOpenChange(false);
    } catch {
      toast.error("Lưu thất bại");
    }
  };

  const meta = (editing?.meta ?? {}) as { org_name?: string; province?: string };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Ticket ${editing.code ?? ""}` : "Tạo ticket"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {editing && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-0.5">
              <p className="text-muted-foreground">
                Gửi lúc {format(new Date(editing.created_at), "HH:mm — dd/MM/yyyy")} · {SOURCE_LABELS[editing.source]}
              </p>
              {rel && (
                <p className="text-foreground">
                  {RELATION_LABELS[rel.kind]}: {rel.label}
                </p>
              )}
              {meta.org_name && (
                <p className="text-foreground">
                  Đơn vị: {meta.org_name}{meta.province ? ` · ${meta.province}` : ""}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Tiêu đề <span className="text-destructive">*</span></Label>
            <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Nội dung</Label>
            <Textarea rows={3} value={form.body} onChange={(e) => set("body", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Nguồn</Label>
              <Select value={form.source} onValueChange={(v) => set("source", v as TicketSource)} disabled={fromForm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABELS) as TicketSource[]).map((k) => (
                    <SelectItem key={k} value={k}>{SOURCE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ưu tiên</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((k) => (
                    <SelectItem key={k} value={k}>{PRIORITY_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as TicketStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>{STATUS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Người gửi</Label>
              <Input value={form.requester_name} onChange={(e) => set("requester_name", e.target.value)} disabled={fromForm} />
            </div>
            <div className="space-y-1.5">
              <Label>SĐT</Label>
              <Input value={form.requester_phone} onChange={(e) => set("requester_phone", e.target.value)} disabled={fromForm} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.requester_email} onChange={(e) => set("requester_email", e.target.value)} disabled={fromForm} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Người xử lý</Label>
            <Select value={form.assignee_id} onValueChange={(v) => set("assignee_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ASSIGNEE}>Chưa giao</SelectItem>
                {(admins ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Ghi chú xử lý</Label>
            <Textarea rows={2} value={form.resolution_note} onChange={(e) => set("resolution_note", e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              Mở lại ticket đã xử lý sẽ xóa ghi chú này (mốc thời gian xử lý vẫn giữ).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={upsert.isPending}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
