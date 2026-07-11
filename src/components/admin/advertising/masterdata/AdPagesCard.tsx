import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAdPages, useUpsertAdPage, useDeleteAdPage } from "@/hooks/useAdMasterData";
import { slugify } from "@/lib/advertising/slug";
import type { AdPage } from "@/types/advertising";

interface EditRowProps {
  initial?: Partial<AdPage>;
  onSave: (data: { name: string; slug: string }) => Promise<void>;
  onCancel: () => void;
}

function EditRow({ initial, onSave, onCancel }: EditRowProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [saving, setSaving] = useState(false);

  const handleName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const submit = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Vui lòng nhập tên và slug");
      return;
    }
    setSaving(true);
    await onSave({ name: name.trim(), slug: slug.trim() });
    setSaving(false);
  };

  return (
    <tr className="bg-muted/30 border-b border-border">
      <td className="px-4 py-3">
        <Input value={name} onChange={(e) => handleName(e.target.value)} placeholder="Tên trang" className="h-8 text-sm" autoFocus />
      </td>
      <td className="px-4 py-3">
        <Input
          value={slug}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
          placeholder="ten-trang"
          className="h-8 text-sm font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={submit} disabled={saving}>
            <Check className="h-3.5 w-3.5 text-success" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
            <X className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function AdPagesCard() {
  const { data: pages, isLoading } = useAdPages();
  const upsert = useUpsertAdPage();
  const del = useDeleteAdPage();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdPage | null>(null);

  const handleSave = async (id: string | undefined, data: { name: string; slug: string }) => {
    try {
      await upsert.mutateAsync({ ...(id ? { id } : {}), ...data });
      toast.success(id ? "Đã cập nhật trang" : "Đã thêm trang");
      setEditingId(null);
      setAddingNew(false);
    } catch {
      toast.error("Thao tác thất bại — slug có thể đã tồn tại");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa trang");
    } catch {
      toast.error("Xóa thất bại — có thể còn vị trí thuộc trang này");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Trang hiển thị</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{pages?.length ?? 0} trang</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setAddingNew(true); setEditingId(null); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm trang
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tên</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Slug</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-24">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
              </tr>
            ))
          ) : (
            pages?.map((p) =>
              editingId === p.id ? (
                <EditRow key={p.id} initial={p} onSave={(d) => handleSave(p.id, d)} onCancel={() => setEditingId(null)} />
              ) : (
                <tr key={p.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{p.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(p.id); setAddingNew(false); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            )
          )}
          {addingNew && <EditRow onSave={(d) => handleSave(undefined, d)} onCancel={() => setAddingNew(false)} />}
          {!isLoading && !addingNew && (!pages || pages.length === 0) && (
            <tr>
              <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground text-sm">Chưa có trang nào.</td>
            </tr>
          )}
        </tbody>
      </table>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa trang hiển thị?</AlertDialogTitle>
            <AlertDialogDescription>
              Trang &quot;{deleteTarget?.name}&quot; sẽ bị xóa. Không thể xóa nếu còn vị trí thuộc trang này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
