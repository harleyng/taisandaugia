import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AdSlot, NativeAdCard } from "@/components/AdSlot";
import { useArticles, useArticleCategories } from "@/hooks/useArticles";
import { relativeTime } from "@/lib/dateUtils";
import type { ArticleWithCategory } from "@/types/article";

const PAGE_SIZE = 12;

const formatViews = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

// ─── Category pill filter ─────────────────────────────────────────────────────

function CategoryFilter({
  active,
  onChange,
}: {
  active: string | undefined;
  onChange: (slug: string | undefined) => void;
}) {
  const { data: categories } = useArticleCategories();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onChange(undefined)}
        className={[
          "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
          !active
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary",
        ].join(" ")}
      >
        Tất cả
      </button>
      {categories?.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.slug)}
          className={[
            "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
            active === cat.slug
              ? "text-white border-transparent"
              : "bg-background border-border hover:border-current",
          ].join(" ")}
          style={
            active === cat.slug
              ? { backgroundColor: cat.color, borderColor: cat.color }
              : { color: cat.color }
          }
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}

// ─── Hero card (first article, full-width in main) ───────────────────────────

function HeroCard({ article, onClick }: { article: ArticleWithCategory; onClick: () => void }) {
  return (
    <article
      className="group cursor-pointer grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="relative aspect-video sm:aspect-auto sm:min-h-[220px] overflow-hidden">
        {article.featured_image_url ? (
          <img
            src={article.featured_image_url}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md">
          <Eye className="h-3 w-3" />
          <span>{formatViews(article.view_count)}</span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-3 p-4 sm:py-5 sm:pr-5 sm:pl-1">
        {article.article_categories && (
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full w-fit"
            style={{
              backgroundColor: `${article.article_categories.color}20`,
              color: article.article_categories.color,
            }}
          >
            {article.article_categories.name}
          </span>
        )}
        <h2 className="text-base md:text-lg font-bold text-foreground line-clamp-3 group-hover:text-primary transition-colors leading-snug">
          {article.title}
        </h2>
        {article.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {article.source_type === "external" && article.source_name && (
            <>
              <span className="font-medium text-foreground/60">{article.source_name}</span>
              <span>·</span>
            </>
          )}
          <span>{relativeTime(article.published_at)}</span>
          {article.read_time_minutes && (
            <>
              <span>·</span>
              <span>{article.read_time_minutes} phút đọc</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Standard grid card ───────────────────────────────────────────────────────

function ArticleCard({ article, onClick }: { article: ArticleWithCategory; onClick: () => void }) {
  return (
    <article
      className="group cursor-pointer flex flex-col rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="relative aspect-video overflow-hidden flex-shrink-0">
        {article.featured_image_url ? (
          <img
            src={article.featured_image_url}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground/40 text-xs">
            Chưa có ảnh
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded">
          <Eye className="h-2.5 w-2.5" />
          <span>{formatViews(article.view_count)}</span>
        </div>
      </div>

      <div className="flex flex-col flex-1 gap-2 p-3.5">
        {article.article_categories && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit"
            style={{
              backgroundColor: `${article.article_categories.color}20`,
              color: article.article_categories.color,
            }}
          >
            {article.article_categories.name}
          </span>
        )}
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
          {article.title}
        </h3>
        <div className="mt-auto flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
          {article.source_type === "external" && article.source_name && (
            <>
              <span className="font-medium text-foreground/60">{article.source_name}</span>
              <span>·</span>
            </>
          )}
          <span>{relativeTime(article.published_at)}</span>
        </div>
      </div>
    </article>
  );
}

// ─── Sidebar mini-card ────────────────────────────────────────────────────────

function SidebarMiniCard({ article, onClick }: { article: ArticleWithCategory; onClick: () => void }) {
  return (
    <article className="group cursor-pointer flex gap-3" onClick={onClick}>
      {article.featured_image_url && (
        <div className="shrink-0 w-16 h-12 rounded-lg overflow-hidden">
          <img
            src={article.featured_image_url}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="min-w-0 flex flex-col gap-0.5">
        <p className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
          {article.title}
        </p>
        <p className="text-[10px] text-muted-foreground">{relativeTime(article.published_at)}</p>
      </div>
    </article>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-border overflow-hidden p-4">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="flex flex-col gap-3 py-2">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-28 mt-1" />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="p-3.5 flex flex-col gap-2">
        <Skeleton className="h-3 w-16 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-20 mt-1" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TinTucPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get("category") ?? undefined;
  const pageParam = Number(searchParams.get("page") ?? "0");

  const { data: articles, isLoading } = useArticles({
    categorySlug,
    limit: PAGE_SIZE,
    page: pageParam,
  });

  // Sidebar: latest 5 articles regardless of active filter
  const { data: sidebarArticles } = useArticles({ limit: 5 });

  const handleCategoryChange = (slug: string | undefined) => {
    setSearchParams(slug ? { category: slug } : {});
  };

  const hasMore = (articles?.length ?? 0) === PAGE_SIZE;
  const heroArticle = articles?.[0];
  const gridArticles = articles?.slice(1) ?? [];

  const goTo = (a: ArticleWithCategory) => navigate(`/tin-tuc/${a.slug}`);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-8 px-4">
          {/* Page title */}
          <div className="mb-5">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tin tức đấu giá</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cập nhật thị trường, kết quả và kiến thức đấu giá
            </p>
          </div>

          {/* Category filter */}
          <div className="mb-6">
            <CategoryFilter active={categorySlug} onChange={handleCategoryChange} />
          </div>

          {/* Main layout: feed (2/3) + sidebar (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Main feed ── */}
            <div className="lg:col-span-2 space-y-5">
              {isLoading ? (
                <>
                  <HeroSkeleton />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
                  </div>
                </>
              ) : !heroArticle ? (
                <div className="py-20 text-center text-muted-foreground">
                  Chưa có bài viết nào trong mục này.
                </div>
              ) : (
                <>
                  {/* Hero */}
                  <HeroCard article={heroArticle} onClick={() => goTo(heroArticle)} />

                  {/* 2-column grid with native ad after article 5 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {gridArticles.flatMap((article, index) => {
                      const card = (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          onClick={() => goTo(article)}
                        />
                      );
                      return index === 4
                        ? [card, <NativeAdCard key="native-ad" />]
                        : [card];
                    })}
                  </div>

                  {/* Mobile banner ad between articles */}
                  <div className="sm:hidden flex justify-center">
                    <AdSlot variant="mobile-banner" className="w-full" />
                  </div>

                  {/* Pagination */}
                  <div className="flex justify-center gap-3 pt-2">
                    {pageParam > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchParams({ ...(categorySlug ? { category: categorySlug } : {}), page: String(pageParam - 1) })}
                      >
                        ← Trang trước
                      </Button>
                    )}
                    {hasMore && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchParams({ ...(categorySlug ? { category: categorySlug } : {}), page: String(pageParam + 1) })}
                      >
                        Xem thêm tin →
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Sidebar ── */}
            <aside className="hidden lg:flex flex-col gap-6">
              <div className="sticky top-4 flex flex-col gap-6">
                {/* Tin nổi bật */}
                {sidebarArticles && sidebarArticles.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-foreground mb-4">Tin nổi bật</h3>
                    <div className="flex flex-col divide-y divide-border">
                      {sidebarArticles
                        .filter((a) => a.id !== heroArticle?.id)
                        .slice(0, 5)
                        .map((a) => (
                          <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                            <SidebarMiniCard article={a} onClick={() => goTo(a)} />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Ad slot 300×250 */}
                <div className="flex justify-center">
                  <AdSlot variant="rectangle" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
