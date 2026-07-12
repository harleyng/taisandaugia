import { useEffect, useState, type ReactNode } from "react";
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
import { PartnerLogoUpload } from "./PartnerLogoUpload";
import { PartnerCard } from "@/components/PartnerCard";
import { PARTNER_COLORS } from "@/lib/partnerTheme";
import { useUpsertPartner } from "@/hooks/usePartners";
import type { Partner, PartnerStat, PartnerStatus } from "@/types/partner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Partner | null;
  /** Gợi ý thứ tự cho đối tác mới (= số đối tác hiện có). */
  nextOrder: number;
}

const COLOR_PRESETS = [
  { label: "Xanh", value: "#367639" },
  { label: "Đỏ", value: "#DA2128" },
  { label: "Navy", value: "#1e3a8a" },
];

const emptyStats = (): PartnerStat[] => [
  { label: "", value: "" },
  { label: "", value: "" },
  { label: "", value: "" },
];

function buildEmpty(order: number) {
  return {
    name: "",
    badge: "",
    accent_color: "#367639",
    logo_url: "",
    tagline: "",
    description: "",
    stats: emptyStats(),
    date_label: "",
    date_value: "",
    cta_text: "",
    cta_href: "",
    sort_order: order,
    status: "active" as PartnerStatus,
  };
}

/** Nhóm field có tiêu đề + khung để phân vùng rõ ràng. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">{hint}</p>}
      <div className={`space-y-3 ${hint ? "" : "mt-3"}`}>{children}</div>
    </div>
  );
}

export function PartnerFormDialog({ open, onOpenChange, editing, nextOrder }: Props) {
  const upsert = useUpsertPartner();
  const [form, setForm] = useState(() => buildEmpty(nextOrder));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const stats = emptyStats();
      (editing.stats ?? []).slice(0, 3).forEach((s, i) => {
        stats[i] = { label: s.label ?? "", value: s.value ?? "" };
      });
      setForm({
        name: editing.name,
        badge: editing.badge ?? "",
        accent_color: editing.accent_color || "#367639",
        logo_url: editing.logo_url ?? "",
        tagline: editing.tagline ?? "",
        description: editing.description ?? "",
        stats,
        date_label: editing.date_label ?? "",
        date_value: editing.date_value ?? "",
        cta_text: editing.cta_text ?? "",
        cta_href: editing.cta_href ?? "",
        sort_order: editing.sort_order,
        status: editing.status,
      });
    } else {
      setForm(buildEmpty(nextOrder));
    }
  }, [open, editing, nextOrder]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setStat = (i: number, key: keyof PartnerStat, value: string) =>
    setForm((f) => ({ ...f, stats: f.stats.map((s, j) => (j === i ? { ...s, [key]: value } : s)) }));

  const cleanStats = form.stats
    .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
    .filter((s) => s.label || s.value);

  // Thẻ preview dựng từ state hiện tại (giữ logo_filter của bản ghi gốc nếu có).
  const previewPartner: Partner = {
    id: "preview",
    name: form.name,
    badge: form.badge,
    accent_color: form.accent_color,
    logo_url: form.logo_url || null,
    logo_filter: editing?.logo_filter ?? null,
    tagline: form.tagline || null,
    description: form.description || null,
    stats: cleanStats,
    date_label: form.date_label || null,
    date_value: form.date_value || null,
    cta_text: form.cta_text || null,
    cta_href: form.cta_href || null,
    sort_order: form.sort_order,
    status: form.status,
    created_at: "",
    updated_at: "",
  };

  const submit = async () => {
    if (form.name.trim().length < 2) return toast.error("Vui lòng nhập tên đối tác");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        badge: form.badge.trim(),
        accent_color: form.accent_color,
        logo_url: form.logo_url.trim() || null,
        tagline: form.tagline.trim() || null,
        description: form.description.trim() || null,
        stats: cleanStats,
        date_label: form.date_label.trim() || null,
        date_value: form.date_value.trim() || null,
        cta_text: form.cta_text.trim() || null,
        cta_href: form.cta_href.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        status: form.status,
      });
      toast.success(editing ? "Đã cập nhật đối tác" : "Đã thêm đối tác");
      onOpenChange(false);
    } catch {
      toast.error("Thao tác thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa đối tác" : "Thêm đối tác"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-6 py-1">
          {/* ── Cột form ── */}
          <div className="space-y-4">
            <Section title="Thông tin cơ bản">
              <div className="space-y-1.5">
                <Label>Logo</Label>
                <PartnerLogoUpload value={form.logo_url} onChange={(url) => set("logo_url", url)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tên đối tác <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Antiquorum" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nhãn (badge)</Label>
                  <Input value={form.badge} onChange={(e) => set("badge", e.target.value)} placeholder="VD: Đối tác toàn cầu" />
                </div>
                <div className="space-y-1.5">
                  <Label>Slogan / tagline</Label>
                  <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Dòng mô tả ngắn" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Màu nhấn</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.accent_color}
                    onChange={(e) => set("accent_color", e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="w-28 font-mono text-xs" />
                  <div className="flex gap-1.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => set("accent_color", c.value)}
                        className="h-7 w-7 rounded-full border border-border"
                        style={{ background: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Nội dung">
              <div className="space-y-1.5">
                <Label>Mô tả</Label>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Giới thiệu về đối tác…" />
              </div>
              <div className="space-y-1.5">
                <Label>Chỉ số nổi bật (tối đa 3)</Label>
                <div className="space-y-2">
                  {form.stats.map((s, i) => (
                    <div key={i} className="grid grid-cols-2 gap-3">
                      <Input value={s.label} onChange={(e) => setStat(i, "label", e.target.value)} placeholder={`Nhãn ${i + 1} (VD: Năm thành lập)`} />
                      <Input value={s.value} onChange={(e) => setStat(i, "value", e.target.value)} placeholder={`Giá trị ${i + 1} (VD: 1974)`} />
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Dòng nổi bật & nút CTA">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nhãn dòng nổi bật</Label>
                  <Input value={form.date_label} onChange={(e) => set("date_label", e.target.value)} placeholder="VD: Vinh danh quốc tế" />
                </div>
                <div className="space-y-1.5">
                  <Label>Giá trị dòng nổi bật</Label>
                  <Input value={form.date_value} onChange={(e) => set("date_value", e.target.value)} placeholder="VD: Cybersecurity Stars 2026" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nút CTA (chữ)</Label>
                  <Input value={form.cta_text} onChange={(e) => set("cta_text", e.target.value)} placeholder="VD: Tìm hiểu thêm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nút CTA (link)</Label>
                  <Input value={form.cta_href} onChange={(e) => set("cta_href", e.target.value)} placeholder="https://…" />
                </div>
              </div>
            </Section>

            <Section title="Hiển thị">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Thứ tự hiển thị</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Trạng thái</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v as PartnerStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Đang hiển thị</SelectItem>
                      <SelectItem value="inactive">Ẩn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>
          </div>

          {/* ── Cột preview ── */}
          <div className="lg:sticky lg:top-0 self-start">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Xem trước</p>
            <div className="rounded-lg p-4" style={{ background: PARTNER_COLORS.bg }}>
              <PartnerCard partner={previewPartner} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">Hiển thị đúng như trên trang chủ</p>
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
