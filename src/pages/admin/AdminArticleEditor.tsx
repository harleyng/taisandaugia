import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ThumbnailUpload } from "@/components/admin/ImageUploadButton";
import { useArticleCategories, useUpsertArticle } from "@/hooks/useArticles";
import { supabase } from "@/integrations/supabase/client";
import type { ArticleWithCategory } from "@/types/article";

const schema = z.object({
  title: z.string().min(3, "Tiêu đề tối thiểu 3 ký tự"),
  slug: z.string().min(3, "Slug tối thiểu 3 ký tự").regex(/^[a-z0-9-]+$/, "Slug chỉ dùng chữ thường, số, gạch ngang"),
  excerpt: z.string().max(300, "Tối đa 300 ký tự").optional().or(z.literal("")),
  featured_image_url: z.string().optional().or(z.literal("")),
  category_id: z.string().optional().or(z.literal("")),
  read_time_minutes: z.coerce.number().int().positive().optional().or(z.literal("")),
  source_type: z.enum(["original", "external"]).default("original"),
  source_name: z.string().optional().or(z.literal("")),
  source_url: z.string().url("URL không hợp lệ").optional().or(z.literal("")),
  show_on_homepage: z.boolean().default(false),
  homepage_position: z.coerce.number().int().min(1).max(5).nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const articlesTable = () => (supabase as any).from("articles");

export default function AdminArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: categories } = useArticleCategories();
  const upsert = useUpsertArticle();

  const [content, setContent] = useState("");
  const [loadingArticle, setLoadingArticle] = useState(isEdit);
  const [existingArticle, setExistingArticle] = useState<ArticleWithCategory | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      slug: "",
      excerpt: "",
      featured_image_url: "",
      category_id: "",
      read_time_minutes: "",
      source_type: "original",
      source_name: "",
      source_url: "",
      show_on_homepage: false,
      homepage_position: null,
    },
  });

  // Load existing article when editing
  useEffect(() => {
    if (!isEdit) return;

    articlesTable()
      .select("*, article_categories(id, name, slug, color)")
      .eq("id", id)
      .single()
      .then(({ data, error }: { data: ArticleWithCategory | null; error: unknown }) => {
        setLoadingArticle(false);
        if (error || !data) {
          toast.error("Không tìm thấy bài viết");
          navigate("/admin/tin-tuc");
          return;
        }
        setExistingArticle(data);
        setContent(data.content ?? "");
        setSlugManuallyEdited(true);
        form.reset({
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt ?? "",
          featured_image_url: data.featured_image_url ?? "",
          category_id: data.category_id ?? "",
          read_time_minutes: data.read_time_minutes ?? "",
          source_type: (data.source_type as "original" | "external") ?? "original",
          source_name: data.source_name ?? "",
          source_url: data.source_url ?? "",
          show_on_homepage: data.show_on_homepage ?? false,
          homepage_position: data.homepage_position ?? null,
        });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-generate slug from title (unless manually edited)
  const watchedTitle = form.watch("title");
  useEffect(() => {
    if (!slugManuallyEdited && watchedTitle) {
      form.setValue("slug", toSlug(watchedTitle), { shouldValidate: false });
    }
  }, [watchedTitle, slugManuallyEdited, form]);

  const handleSave = useCallback(
    async (publish: boolean) => {
      const valid = await form.trigger();
      if (!valid) {
        toast.error("Vui lòng kiểm tra lại các trường thông tin");
        return;
      }
      const values = form.getValues();

      try {
        const payload = {
          ...(isEdit && existingArticle ? { id: existingArticle.id } : {}),
          title: values.title,
          slug: values.slug,
          excerpt: values.excerpt || null,
          content: content || null,
          featured_image_url: values.featured_image_url || null,
          category_id: values.category_id || null,
          read_time_minutes: values.read_time_minutes ? Number(values.read_time_minutes) : null,
          source_type: values.source_type,
          source_name: values.source_type === "external" ? (values.source_name || null) : null,
          source_url: values.source_type === "external" ? (values.source_url || null) : null,
          show_on_homepage: values.show_on_homepage ?? false,
          homepage_position: values.show_on_homepage ? (values.homepage_position ?? null) : null,
          status: publish ? "published" : "draft",
          published_at: publish
            ? existingArticle?.published_at ?? new Date().toISOString()
            : null,
        };

        await upsert.mutateAsync(payload);
        toast.success(publish ? "Đã đăng bài thành công" : "Đã lưu nháp");
        navigate("/admin/tin-tuc");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        toast.error(`Lưu thất bại: ${msg}`);
      }
    },
    [form, content, isEdit, existingArticle, upsert, navigate]
  );

  if (loadingArticle) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tin-tuc")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {isEdit ? "Chỉnh sửa bài viết" : "Viết bài mới"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={upsert.isPending}
            onClick={() => handleSave(false)}
          >
            <Save className="h-4 w-4 mr-1.5" />
            Lưu nháp
          </Button>
          <Button
            size="sm"
            disabled={upsert.isPending}
            onClick={() => handleSave(true)}
          >
            <Send className="h-4 w-4 mr-1.5" />
            Đăng bài
          </Button>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main editor — left 2/3 */}
        <div className="xl:col-span-2">
          <div className="bg-card border border-border rounded-xl p-5 space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Tiêu đề <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="Nhập tiêu đề bài viết..."
                className="text-base font-medium"
                {...form.register("title")}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug (URL) <span className="text-destructive">*</span></Label>
              <Input
                id="slug"
                placeholder="ten-bai-viet"
                className="font-mono text-sm"
                {...form.register("slug", {
                  onChange: () => setSlugManuallyEdited(true),
                })}
              />
              {form.formState.errors.slug && (
                <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                URL: /tin-tuc/<span className="font-mono">{form.watch("slug") || "slug-bai-viet"}</span>
              </p>
            </div>

            {/* Content editor */}
            <div className="space-y-1.5">
              <Label>Nội dung bài viết</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Nhập nội dung bài viết..."
              />
            </div>
          </div>
        </div>

        {/* Settings sidebar — right 1/3 */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Cài đặt bài viết</h3>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Danh mục</Label>
              <Select
                value={form.watch("category_id") || "none"}
                onValueChange={(v) => form.setValue("category_id", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không có danh mục</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Featured image */}
            <div className="space-y-1.5">
              <Label>Ảnh đại diện</Label>
              <ThumbnailUpload
                value={form.watch("featured_image_url") ?? ""}
                onChange={(url) => form.setValue("featured_image_url", url, { shouldValidate: true })}
              />
            </div>

            {/* Excerpt */}
            <div className="space-y-1.5">
              <Label htmlFor="excerpt">Tóm tắt</Label>
              <Textarea
                id="excerpt"
                rows={3}
                placeholder="Tóm tắt ngắn về nội dung bài viết..."
                className="resize-none text-sm"
                {...form.register("excerpt")}
              />
              {form.formState.errors.excerpt && (
                <p className="text-xs text-destructive">{form.formState.errors.excerpt.message}</p>
              )}
            </div>

            {/* Read time */}
            <div className="space-y-1.5">
              <Label htmlFor="read_time_minutes">Thời gian đọc (phút)</Label>
              <Input
                id="read_time_minutes"
                type="number"
                min={1}
                placeholder="3"
                {...form.register("read_time_minutes")}
              />
            </div>
          </div>

          {/* Source type */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Nguồn bài viết</h3>

            <div className="grid grid-cols-2 gap-2">
              {(["original", "external"] as const).map((type) => {
                const active = form.watch("source_type") === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      form.setValue("source_type", type);
                      if (type === "original") {
                        form.setValue("source_name", "");
                        form.setValue("source_url", "");
                      }
                    }}
                    className={[
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground",
                    ].join(" ")}
                  >
                    <span className="text-base">{type === "original" ? "✍️" : "🔗"}</span>
                    {type === "original" ? "Nền tảng tự đăng" : "Nguồn bên ngoài"}
                  </button>
                );
              })}
            </div>

            {form.watch("source_type") === "external" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="source_name">Tên nguồn</Label>
                  <Input
                    id="source_name"
                    placeholder="VnExpress, Dân trí..."
                    {...form.register("source_name")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="source_url">URL bài gốc</Label>
                  <Input
                    id="source_url"
                    placeholder="https://..."
                    {...form.register("source_url")}
                  />
                  {form.formState.errors.source_url && (
                    <p className="text-xs text-destructive">{form.formState.errors.source_url.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Homepage display */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Hiển thị trang chủ</h3>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Hiển thị trên trang chủ</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bài sẽ xuất hiện trong khối Tin tức</p>
              </div>
              <Switch
                checked={form.watch("show_on_homepage") ?? false}
                onCheckedChange={(v) => {
                  form.setValue("show_on_homepage", v);
                  if (!v) form.setValue("homepage_position", null);
                }}
              />
            </div>

            {form.watch("show_on_homepage") && (
              <div className="space-y-1.5">
                <Label>Vị trí ưu tiên</Label>
                <Select
                  value={String(form.watch("homepage_position") ?? "auto")}
                  onValueChange={(v) =>
                    form.setValue("homepage_position", v === "auto" ? null : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Tự động (theo ngày đăng)</SelectItem>
                    <SelectItem value="1">1 — Bài nổi bật (ảnh lớn, trái)</SelectItem>
                    <SelectItem value="2">2 — Card phụ thứ nhất</SelectItem>
                    <SelectItem value="3">3 — Card phụ thứ hai</SelectItem>
                    <SelectItem value="4">4 — Danh sách compact #1</SelectItem>
                    <SelectItem value="5">5 — Danh sách compact #2</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vị trí cố định sẽ ưu tiên hơn thứ tự thời gian. Nếu 2 bài cùng vị trí, bài mới hơn sẽ chiếm slot đó.
                </p>
              </div>
            )}
          </div>

          {/* Bottom action row on mobile */}
          <div className="xl:hidden flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={upsert.isPending}
              onClick={() => handleSave(false)}
            >
              Lưu nháp
            </Button>
            <Button
              className="flex-1"
              disabled={upsert.isPending}
              onClick={() => handleSave(true)}
            >
              Đăng bài
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
