import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, EyeOff, Tag, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useAdminArticles, useDeleteArticle, useTogglePublish } from "@/hooks/useArticles";
import type { ArticleWithCategory } from "@/types/article";

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function ArticleRow({ article, onEdit, onDelete, onTogglePublish }: {
  article: ArticleWithCategory;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) {
  const isPublished = article.status === "published";

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 w-16">
        {article.featured_image_url ? (
          <img
            src={article.featured_image_url}
            alt=""
            className="w-12 h-9 object-cover rounded-md"
          />
        ) : (
          <div className="w-12 h-9 rounded-md bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-[10px]">No img</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 min-w-0">
        <p className="text-sm font-medium text-foreground line-clamp-2">{article.title}</p>
        {article.source_name && (
          <p className="text-xs text-muted-foreground mt-0.5">Nguồn: {article.source_name}</p>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {article.article_categories ? (
          <Badge
            variant="secondary"
            className="text-xs"
            style={{
              backgroundColor: `${article.article_categories.color}20`,
              color: article.article_categories.color,
            }}
          >
            {article.article_categories.name}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <Badge variant={isPublished ? "default" : "secondary"} className="text-xs w-fit">
            {isPublished ? "Đã đăng" : "Nháp"}
          </Badge>
          {article.show_on_homepage && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded w-fit">
              <Home className="h-2.5 w-2.5" />
              {article.homepage_position ? `Vị trí ${article.homepage_position}` : "Trang chủ"}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(article.published_at)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title={isPublished ? "Gỡ xuống" : "Đăng bài"}
            onClick={onTogglePublish}
          >
            {isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Sửa" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            title="Xóa"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminArticlesPage() {
  const navigate = useNavigate();
  const { data: articles, isLoading } = useAdminArticles();
  const deleteArticle = useDeleteArticle();
  const togglePublish = useTogglePublish();

  const [deleteTarget, setDeleteTarget] = useState<ArticleWithCategory | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteArticle.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa bài viết");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  const handleTogglePublish = async (article: ArticleWithCategory) => {
    const publish = article.status !== "published";
    try {
      await togglePublish.mutateAsync({ id: article.id, publish });
      toast.success(publish ? "Đã đăng bài" : "Đã gỡ xuống nháp");
    } catch {
      toast.error("Thao tác thất bại");
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Quản lý tin tức</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {articles?.length ?? 0} bài viết
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/tin-tuc/danh-muc")}
          >
            <Tag className="h-4 w-4 mr-1.5" />
            Danh mục
          </Button>
          <Button size="sm" onClick={() => navigate("/admin/tin-tuc/new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            Viết bài mới
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-16">Ảnh</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tiêu đề</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Danh mục</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Trạng thái</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Ngày đăng</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3"><Skeleton className="w-12 h-9 rounded-md" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))
              ) : !articles || articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    Chưa có bài viết nào.{" "}
                    <button
                      className="text-primary underline"
                      onClick={() => navigate("/admin/tin-tuc/new")}
                    >
                      Viết bài đầu tiên
                    </button>
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    onEdit={() => navigate(`/admin/tin-tuc/${article.id}`)}
                    onDelete={() => setDeleteTarget(article)}
                    onTogglePublish={() => handleTogglePublish(article)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bài viết?</AlertDialogTitle>
            <AlertDialogDescription>
              Bài &quot;{deleteTarget?.title}&quot; sẽ bị xóa vĩnh viễn và không thể khôi phục.
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
