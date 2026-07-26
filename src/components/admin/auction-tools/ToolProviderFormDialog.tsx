import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUpsertProvider } from "@/hooks/useAuctionTools";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useServices } from "@/hooks/useServices";
import { useServiceVariants } from "@/hooks/useServiceVariants";
import { ShowcaseEditor } from "./ShowcaseEditor";
import { slugify } from "@/lib/advertising/slug";
import type { AuctionTool, AuctionToolProvider, ProviderStatus } from "@/types/auctionTools";

const NONE = "__none__";

interface Draft {
  tool_id: string;
  name: string;
  slug: string;
  is_own: boolean;
  supplier_id: string | null;
  service_id: string | null;
  service_variant_id: string | null;
  logo_url: string;
  tagline: string;
  description: string;
  website: string;
  price_label: string;
  status: ProviderStatus;
  sort_order: number;
}

const empty = (toolId: string): Draft => ({
  tool_id: toolId, name: "", slug: "", is_own: false,
  supplier_id: null, service_id: null, service_variant_id: null,
  logo_url: "", tagline: "", description: "", website: "", price_label: "",
  status: "active", sort_order: 0,
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: AuctionToolProvider | null;
  tools: AuctionTool[];
  defaultToolId: string;
}

export function ToolProviderFormDialog({ open, onOpenChange, editing, tools, defaultToolId }: Props) {
  const upsert = useUpsertProvider();
  const { data: suppliers } = useSuppliers();
  const { data: services } = useServices();
  const { data: variants } = useServiceVariants();

  const [form, setForm] = useState<Draft>(empty(defaultToolId));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        tool_id: editing.tool_id,
        name: editing.name,
        slug: editing.slug,
        is_own: editing.is_own,
        supplier_id: editing.supplier_id,
        service_id: editing.service_id,
        service_variant_id: editing.service_variant_id,
        logo_url: editing.logo_url ?? "",
        tagline: editing.tagline ?? "",
        description: editing.description ?? "",
        website: editing.website ?? "",
        price_label: editing.price_label ?? "",
        status: editing.status,
        sort_order: editing.sort_order,
      });
    } else {
      setForm(empty(defaultToolId));
    }
  }, [open, editing, defaultToolId]);

  const serviceVariants = useMemo(
    () => (variants ?? []).filter((v) => v.service_id === form.service_id),
    [variants, form.service_id],
  );

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nhập tên đơn vị cung cấp");
    const slug = form.slug.trim() || slugify(form.name);
    if (!slug) return toast.error("Không tạo được slug — nhập thủ công");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        tool_id: form.tool_id,
        name: form.name.trim(),
        slug,
        is_own: form.is_own,
        supplier_id: form.supplier_id,
        service_id: form.service_id,
        service_variant_id: form.service_id ? form.service_variant_id : null,
        logo_url: form.logo_url.trim() || null,
        tagline: form.tagline.trim() || null,
        description: form.description.trim() || null,
        website: form.website.trim() || null,
        price_label: form.price_label.trim() || null,
        status: form.status,
        sort_order: form.sort_order,
      });
      toast.success(editing ? "Đã cập nhật đơn vị cung cấp" : "Đã thêm đơn vị cung cấp");
      onOpenChange(false);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      toast.error(msg.includes("duplicate") ? "Slug đã tồn tại — đổi slug khác" : "Lưu thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa đơn vị cung cấp" : "Thêm đơn vị cung cấp"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Công cụ</Label>
            <Select value={form.tool_id} onValueChange={(v) => set("tool_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tools.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Trạng thái</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as ProviderStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Đang hiển thị</SelectItem>
                <SelectItem value="inactive">Tạm ẩn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tên đơn vị</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Slug (URL)</Label>
            <Input
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder={slugify(form.name) || "vd: silvermedia"}
            />
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <Switch checked={form.is_own} onCheckedChange={(v) => set("is_own", v)} id="is_own" />
            <Label htmlFor="is_own" className="cursor-pointer">Công cụ nhà (SSCorp) — không tính hoa hồng</Label>
          </div>

          <div>
            <Label>Đối tác (supplier)</Label>
            <Select
              value={form.supplier_id ?? NONE}
              onValueChange={(v) => set("supplier_id", v === NONE ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="— Chưa gắn —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Chưa gắn —</SelectItem>
                {(suppliers ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dịch vụ (để phát sinh đơn)</Label>
            <Select
              value={form.service_id ?? NONE}
              onValueChange={(v) => { set("service_id", v === NONE ? null : v); set("service_variant_id", null); }}
            >
              <SelectTrigger><SelectValue placeholder="— Chưa gắn —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— Chưa gắn —</SelectItem>
                {(services ?? []).filter((s) => s.kind !== "credit").map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.service_id && serviceVariants.length > 0 && (
            <div className="col-span-2">
              <Label>Biến thể dịch vụ</Label>
              <Select
                value={form.service_variant_id ?? NONE}
                onValueChange={(v) => set("service_variant_id", v === NONE ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="— Không chọn —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Không chọn —</SelectItem>
                  {serviceVariants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="col-span-2">
            <Label>Tagline</Label>
            <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Giới thiệu chi tiết</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Logo URL</Label>
            <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Nhãn giá hiển thị</Label>
            <Input value={form.price_label} onChange={(e) => set("price_label", e.target.value)} placeholder="Liên hệ báo giá" />
          </div>
          <div>
            <Label>Thứ tự</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="mt-2 border-t border-border pt-4">
          <ShowcaseEditor providerId={editing?.id} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={save} disabled={upsert.isPending}>
            {editing ? "Lưu" : "Thêm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
