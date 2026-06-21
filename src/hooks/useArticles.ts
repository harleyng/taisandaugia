import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Article, ArticleCategory, ArticleWithCategory } from "@/types/article";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const articlesTable = () => (supabase as any).from("articles");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const categoriesTable = () => (supabase as any).from("article_categories");

// ─── Categories ──────────────────────────────────────────────────────────────

export function useArticleCategories() {
  return useQuery<ArticleCategory[]>({
    queryKey: ["article_categories"],
    queryFn: async () => {
      const { data, error } = await categoriesTable()
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ArticleCategory[];
    },
    staleTime: 10 * 60_000,
  });
}

// ─── Homepage articles (ordered by position then published_at) ───────────────

export function useHomepageArticles() {
  return useQuery<ArticleWithCategory[]>({
    queryKey: ["articles_homepage"],
    queryFn: async () => {
      const { data, error } = await articlesTable()
        .select("*, article_categories(id, name, slug, color)")
        .eq("status", "published")
        .eq("show_on_homepage", true)
        .order("homepage_position", { ascending: true, nullsFirst: false })
        .order("published_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as ArticleWithCategory[];
    },
    staleTime: 2 * 60_000,
  });
}

// ─── Article list ─────────────────────────────────────────────────────────────

interface UseArticlesOptions {
  categorySlug?: string;
  limit?: number;
  page?: number;
  status?: "published" | "draft" | "all";
}

export function useArticles(options: UseArticlesOptions = {}) {
  const { categorySlug, limit = 12, page = 0, status = "published" } = options;
  const queryClient = useQueryClient();

  return useQuery<ArticleWithCategory[]>({
    queryKey: ["articles", { categorySlug, limit, page, status }],
    queryFn: async () => {
      let categoryId: string | undefined;
      if (categorySlug) {
        // Resolve slug → id từ danh sách category đã cache (cùng key với
        // useArticleCategories, staleTime 10 phút) thay vì query riêng theo slug.
        const categories = await queryClient.ensureQueryData<ArticleCategory[]>({
          queryKey: ["article_categories"],
          queryFn: async () => {
            const { data, error } = await categoriesTable().select("*").order("name");
            if (error) throw error;
            return data as ArticleCategory[];
          },
          staleTime: 10 * 60_000,
        });
        categoryId = categories.find((c) => c.slug === categorySlug)?.id;
      }

      let query = articlesTable()
        .select("*, article_categories(id, name, slug, color)")
        .order("published_at", { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (status !== "all") {
        query = query.eq("status", status);
      }

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ArticleWithCategory[];
    },
    staleTime: 60_000,
  });
}

// ─── Single article ───────────────────────────────────────────────────────────

export function useArticle(slug: string) {
  const queryClient = useQueryClient();

  return useQuery<ArticleWithCategory>({
    queryKey: ["article", slug],
    queryFn: async () => {
      const { data, error } = await articlesTable()
        .select("*, article_categories(id, name, slug, color)")
        .eq("slug", slug)
        .eq("status", "published")
        .single();
      if (error) throw error;

      // Increment view count (fire-and-forget)
      articlesTable()
        .update({ view_count: (data as Article).view_count + 1 })
        .eq("id", (data as Article).id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["articles"] });
        });

      return data as ArticleWithCategory;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}

// ─── Admin: all articles (incl. drafts) ──────────────────────────────────────

export function useAdminArticles() {
  return useQuery<ArticleWithCategory[]>({
    queryKey: ["admin_articles"],
    queryFn: async () => {
      const { data, error } = await articlesTable()
        .select("*, article_categories(id, name, slug, color)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ArticleWithCategory[];
    },
  });
}

// ─── Admin: upsert article ────────────────────────────────────────────────────

type ArticleUpsert = Partial<Omit<Article, "id" | "created_at" | "updated_at" | "article_categories">>;

export function useUpsertArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: ArticleUpsert & { id?: string }) => {
      if (id) {
        const { data, error } = await articlesTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Article;
      }
      const { data, error } = await articlesTable()
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Article;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["admin_articles"] });
    },
  });
}

// ─── Admin: delete article ────────────────────────────────────────────────────

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await articlesTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["admin_articles"] });
    },
  });
}

// ─── Admin: toggle publish ────────────────────────────────────────────────────

export function useTogglePublish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      const { error } = await articlesTable()
        .update({
          status: publish ? "published" : "draft",
          published_at: publish ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["admin_articles"] });
    },
  });
}

// ─── Admin: categories CRUD ───────────────────────────────────────────────────

export function useUpsertCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<ArticleCategory> & { id?: string }) => {
      if (id) {
        const { data, error } = await categoriesTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as ArticleCategory;
      }
      const { data, error } = await categoriesTable()
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as ArticleCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article_categories"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await categoriesTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article_categories"] });
    },
  });
}
