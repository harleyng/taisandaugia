import { useParams, useNavigate, Link } from "react-router-dom";
import { Eye, ExternalLink, Link2, Facebook, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AdSlot } from "@/components/AdSlot";
import { useArticle, useArticles, useArticleCategories } from "@/hooks/useArticles";
import { formatDateLong, relativeTime } from "@/lib/dateUtils";
import { toast } from "sonner";
import type { ArticleWithCategory } from "@/types/article";

const formatViews = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

// ─── "Có thể bạn quan tâm" card ──────────────────────────────────────────────

function SidebarRelatedCard({ article, onClick }: { article: ArticleWithCategory; onClick: () => void }) {
  return (
    <div className="group flex gap-3 cursor-pointer py-3 first:pt-0 border-b border-border last:border-0 last:pb-0" onClick={onClick}>
      {article.featured_image_url && (
        <div className="shrink-0 w-20 h-14 rounded-lg overflow-hidden">
          <img
            src={article.featured_image_url}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="min-w-0 flex flex-col gap-1">
        <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {article.title}
        </p>
        <p className="text-[10px] text-muted-foreground">{relativeTime(article.published_at)}</p>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-4/5" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      <div className="space-y-2.5">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    </div>
  );
}

// ─── Share bar ────────────────────────────────────────────────────────────────

function ShareBar({ title }: { title: string }) {
  const url = window.location.href;

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(() => toast.success("Đã sao chép liên kết"));
  };

  const fbShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,width=600,height=400");
  };

  return (
    <div className="flex items-center gap-2 py-3 border-y border-border my-5">
      <button
        onClick={fbShare}
        className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#1877F2] hover:bg-[#166fe5] px-3 py-1.5 rounded-full transition-colors"
      >
        <Facebook className="h-3.5 w-3.5" />
        Chia sẻ
      </button>
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border hover:border-primary hover:text-primary px-3 py-1.5 rounded-full transition-colors"
      >
        <Link2 className="h-3.5 w-3.5" />
        Sao chép link
      </button>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Eye className="h-3.5 w-3.5" />
        <span id="view-count" />
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: article, isLoading, isError } = useArticle(slug ?? "");
  const { data: relatedArticles } = useArticles({
    categorySlug: article?.article_categories?.slug,
    limit: 5,
  });
  const { data: categories } = useArticleCategories();

  const related = relatedArticles?.filter((a) => a.id !== article?.id).slice(0, 4) ?? [];

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-16 px-4 text-center">
          <h1 className="text-xl font-semibold mb-4">Không tìm thấy bài viết</h1>
          <Button onClick={() => navigate("/tin-tuc")}>Quay lại danh sách</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const cat = article?.article_categories;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container py-6 px-4">
          {/* Breadcrumb row with date */}
          <div className="flex items-center justify-between gap-4 mb-5 text-xs">
            <nav className="flex items-center gap-1 font-semibold uppercase tracking-wide">
              <Link to="/tin-tuc" className="text-primary hover:underline underline-offset-2">
                Tin tức
              </Link>
              {cat && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <button
                    className="hover:underline underline-offset-2"
                    style={{ color: cat.color }}
                    onClick={() => navigate(`/tin-tuc?category=${cat.slug}`)}
                  >
                    {cat.name}
                  </button>
                </>
              )}
            </nav>
            {article?.published_at && (
              <span className="text-muted-foreground shrink-0">
                {formatDateLong(article.published_at)}
              </span>
            )}
          </div>

          {/* 2-col: article + sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* ── Main article ── */}
            <div className="lg:col-span-2">
              {isLoading ? (
                <ArticleSkeleton />
              ) : article ? (
                <article>
                  {/* Title */}
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight mb-4">
                    {article.title}
                  </h1>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {article.source_type === "external" && article.source_name && (
                      <span className="font-semibold text-foreground/70 uppercase tracking-wide">
                        {article.source_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {formatViews(article.view_count)} lượt xem
                    </span>
                    {article.read_time_minutes && (
                      <span>{article.read_time_minutes} phút đọc</span>
                    )}
                    <span>{relativeTime(article.published_at)}</span>
                  </div>

                  {/* Share bar */}
                  <ShareBar title={article.title} />

                  {/* Excerpt — bold lead paragraph */}
                  {article.excerpt && (
                    <p className="text-base font-semibold text-foreground leading-relaxed mb-6">
                      {article.excerpt}
                    </p>
                  )}

                  {/* Featured image */}
                  {article.featured_image_url && (
                    <figure className="rounded-xl overflow-hidden mb-6">
                      <img
                        src={article.featured_image_url}
                        alt={article.title}
                        className="w-full object-cover"
                      />
                    </figure>
                  )}

                  {/* Article body */}
                  {article.content ? (
                    <div
                      className="article-body text-[15px] leading-[1.8] text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: article.content }}
                    />
                  ) : (
                    <p className="text-muted-foreground italic">Chưa có nội dung.</p>
                  )}

                  {/* Source */}
                  {article.source_type === "external" && article.source_name && (
                    <div className="mt-8 pt-4 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Nguồn:</span>
                      {article.source_url ? (
                        <a
                          href={article.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary flex items-center gap-1 hover:underline"
                        >
                          {article.source_name}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="font-medium text-foreground/70">{article.source_name}</span>
                      )}
                    </div>
                  )}

                  {/* Back */}
                  <div className="mt-8 pt-4 border-t border-border">
                    <button
                      onClick={() => navigate("/tin-tuc")}
                      className="text-sm text-primary hover:underline underline-offset-2 font-medium"
                    >
                      ← Quay lại danh sách tin tức
                    </button>
                  </div>
                </article>
              ) : null}
            </div>

            {/* ── Sidebar ── */}
            <aside className="hidden lg:block">
              <div className="sticky top-4 space-y-5">
                {/* Ad */}
                <div className="flex justify-center">
                  <AdSlot variant="rectangle" />
                </div>

                {/* Có thể bạn quan tâm */}
                {related.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-1">
                      Có thể bạn quan tâm
                    </h3>
                    <div>
                      {related.map((r) => (
                        <SidebarRelatedCard
                          key={r.id}
                          article={r}
                          onClick={() => navigate(`/tin-tuc/${r.slug}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Danh mục */}
                {categories && categories.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">
                      Danh mục tin tức
                    </h3>
                    <div className="space-y-0.5">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          className="flex items-center gap-2 w-full text-left text-sm text-muted-foreground hover:text-primary transition-colors py-1.5 group"
                          onClick={() => navigate(`/tin-tuc?category=${cat.slug}`)}
                        >
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="group-hover:translate-x-0.5 transition-transform">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
