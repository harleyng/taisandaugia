import { useState } from "react";
import { Plus, Pencil, Trash2, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useProviderShowcases, useUpsertShowcase, useDeleteShowcase,
} from "@/hooks/useAuctionTools";
import type { AuctionToolShowcase, ShowcaseKind, ShowcaseVisibility } from "@/types/auctionTools";

const KIND_LABELS: Record<ShowcaseKind, string> = {
  tour_3d: "Tour 3D",
  image: "Hình ảnh",
  video: "Video",
  link: "Liên kết",
};

interface Draft {
  id?: string;
  title: string;
  kind: ShowcaseKind;
  url: string;
  thumbnail_url: string;
  description: string;
  visibility: ShowcaseVisibility;
  access_password: string;
  sort_order: number;
}

const EMPTY: Draft = {
  title: "", kind: "tour_3d", url: "", thumbnail_url: "", description: "",
  visibility: "public", access_password: "", sort_order: 0,
};

/** Editor showcase lồng trong dialog provider. providerId có nghĩa là provider đã
 *  lưu — showcase cần provider_id nên chỉ bật sau khi provider tồn tại. */
export function ShowcaseEditor({ providerId }: { providerId?: string }) {
  const { data: showcases, isLoading } = useProviderShowcases(providerId);
  const upsert = useUpsertShowcase();
  const del = useDeleteShowcase();

  const [draft, setDraft] = useState<Draft | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  if (!providerId) {
    return (
      <p className="text-sm text-muted-foreground">
        Lưu đơn vị cung cấp trước để thêm showcase.
      </p>
    );
  }

  const startAdd = () => setDraft({ ...EMPTY, sort_order: (showcases?.length ?? 0) + 1 });
  const startEdit = (s: AuctionToolShowcase) =>
    setDraft({
      id: s.id, title: s.title, kind: s.kind, url: s.url,
      thumbnail_url: s.thumbnail_url ?? "", description: s.description ?? "",
      visibility: s.visibility, access_password: s.access_password ?? "",
      sort_order: s.sort_order,
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return toast.error("Nhập tiêu đề showcase");
    if (!draft.url.trim()) return toast.error("Nhập đường dẫn showcase");
    if (draft.visibility === "password" && !draft.access_password.trim())
      return toast.error("Showcase bảo mật cần mật khẩu");
    try {
      await upsert.mutateAsync({
        ...(draft.id ? { id: draft.id } : {}),
        provider_id: providerId,
        title: draft.title.trim(),
        kind: draft.kind,
        url: draft.url.trim(),
        thumbnail_url: draft.thumbnail_url.trim() || null,
        description: draft.description.trim() || null,
        visibility: draft.visibility,
        access_password: draft.visibility === "password" ? draft.access_password.trim() : null,
        sort_order: draft.sort_order,
      });
      toast.success(draft.id ? "Đã cập nhật showcase" : "Đã thêm showcase");
      setDraft(null);
    } catch {
      toast.error("Lưu showcase thất bại");
    }
  };

  const remove = async (s: AuctionToolShowcase) => {
    try {
      await del.mutateAsync({ id: s.id, providerId });
      toast.success("Đã xóa showcase");
    } catch {
      toast.error("Xóa thất bại");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Showcase ({showcases?.length ?? 0})</Label>
        {!draft && (
          <Button type="button" variant="outline" size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4 mr-1.5" /> Thêm showcase
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}

      {!draft && (showcases ?? []).length > 0 && (
        <ul className="space-y-1.5">
          {(showcases ?? []).map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              {s.visibility === "password"
                ? <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                : <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {KIND_LABELS[s.kind]} · {s.url}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(s)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(s)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Tiêu đề</Label>
              <Input value={draft.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <Label>Loại</Label>
              <Select value={draft.kind} onValueChange={(v) => set("kind", v as ShowcaseKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABELS) as ShowcaseKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hiển thị</Label>
              <Select value={draft.visibility} onValueChange={(v) => set("visibility", v as ShowcaseVisibility)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Công khai</SelectItem>
                  <SelectItem value="password">Cần mật khẩu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Đường dẫn (URL tour 3D / ảnh / video / link)</Label>
              <Input value={draft.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
            </div>
            {draft.visibility === "password" && (
              <div className="col-span-2">
                <Label>Mật khẩu truy cập</Label>
                <Input value={draft.access_password} onChange={(e) => set("access_password", e.target.value)} />
              </div>
            )}
            <div className="col-span-2">
              <Label>Ảnh đại diện (tuỳ chọn)</Label>
              <Input value={draft.thumbnail_url} onChange={(e) => set("thumbnail_url", e.target.value)} placeholder="https://…" />
            </div>
            <div className="col-span-2">
              <Label>Mô tả (tuỳ chọn)</Label>
              <Textarea value={draft.description} onChange={(e) => set("description", e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Thứ tự</Label>
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>Hủy</Button>
            <Button type="button" size="sm" onClick={save} disabled={upsert.isPending}>
              {draft.id ? "Cập nhật" : "Thêm"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
