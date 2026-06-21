import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X } from "lucide-react";
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
import { useArticleCategories, useUpsertCategory, useDeleteCategory } from "@/hooks/useArticles";
import type { ArticleCategory } from "@/types/article";

const PRESET_COLORS = [
  "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B",
  "#EF4444", "#EC4899", "#14B8A6", "#F97316",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

interface EditRowProps {
  initial?: Partial<ArticleCategory>;
  onSave: (data: { name: string; slug: string; color: string }) => Promise<void>;
  onCancel: () => void;
}

function EditRow({ initial, onSave, onCancel }: EditRowProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [saving, setSaving] = useState(false);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Vui lòng nhập tên và slug");
      return;
    }
    setSaving(true);
    await onSave({ name: name.trim(), slug: slug.trim(), color });
    setSaving(false);
  };

  return (
    <tr className="bg-muted/30 border-b border-border">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-border"
          />
          <div className="flex gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Tên danh mục"
          className="h-8 text-sm"
          autoFocus
        />
      </td>
      <td className="px-4 py-3">
        <Input
          value={slug}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
          placeholder="ten-danh-muc"
          className="h-8 text-sm font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSubmit} disabled={saving}>
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

export default function AdminCategoriesPage() {
  const navigate = useNavigate();
  const { data: categories, isLoading } = useArticleCategories();
  const upsert = useUpsertCategory();
  const deleteCategory = useDeleteCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArticleCategory | null>(null);

  const handleSave = async (id: string | undefined, data: { name: string; slug: string; color: string }) => {
    try {
      await upsert.mutateAsync({ ...(id ? { id } : {}), ...data });
      toast.success(id ? "Đã cập nhật danh mục" : "Đã thêm danh mục");
      setEditingId(null);
      setAddingNew(false);
    } catch {
      toast.error("Thao tác thất bại");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa danh mục");
    } catch {
      toast.error("Xóa thất bại — có thể danh mục đang được dùng bởi bài viết");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tin-tuc")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Quản lý danh mục</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{categories?.length ?? 0} danh mục</p>
        </div>
        <Button size="sm" onClick={() => { setAddingNew(true); setEditingId(null); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm danh mục
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Màu</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tên</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Slug</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="w-8 h-8 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                </tr>
              ))
            ) : (
              categories?.map((cat) =>
                editingId === cat.id ? (
                  <EditRow
                    key={cat.id}
                    initial={cat}
                    onSave={(data) => handleSave(cat.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <tr key={cat.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div
                        className="w-7 h-7 rounded-full border border-border"
                        style={{ backgroundColor: cat.color }}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{cat.slug}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => { setEditingId(cat.id); setAddingNew(false); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(cat)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
            {addingNew && (
              <EditRow
                onSave={(data) => handleSave(undefined, data)}
                onCancel={() => setAddingNew(false)}
              />
            )}
            {!isLoading && !addingNew && (!categories || categories.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Chưa có danh mục nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa danh mục?</AlertDialogTitle>
            <AlertDialogDescription>
              Danh mục &quot;{deleteTarget?.name}&quot; sẽ bị xóa. Các bài viết thuộc danh mục này sẽ không còn danh mục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
