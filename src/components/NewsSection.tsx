import { ArrowRight, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHomepageArticles } from "@/hooks/useArticles";
import { relativeTime } from "@/lib/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ArticleWithCategory } from "@/types/article";

import apartmentSample from "@/assets/apartment-sample.jpg";
import houseSample from "@/assets/house-sample.jpg";
import penthouseSample from "@/assets/penthouse-sample.jpg";

// Fallback data — shown while DB has no homepage articles yet
const FALLBACK: ArticleWithCategory[] = [
  {
    id: "1", slug: "", status: "published", author_id: null,
    featured_image_url: apartmentSample,
    title: "Phiên đấu giá đất Thanh Oai lập kỷ lục chênh lệch giá 2.400%",
    excerpt: "Lô đất khởi điểm 1,8 triệu/m² được trả lên tới 45 triệu/m², tạo nên kỷ lục chênh lệch giá chưa từng có tại Việt Nam.",
    source_type: "external", source_name: "Dân trí", source_url: null,
    published_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    view_count: 21900, read_time_minutes: 2,
    show_on_homepage: true, homepage_position: 1,
    category_id: null, content: null,
    created_at: "", updated_at: "",
    article_categories: { id: "1", name: "Kết quả đấu giá", slug: "ket-qua-dau-gia", color: "#10B981", created_at: "" },
  },
  {
    id: "2", slug: "", status: "published", author_id: null,
    featured_image_url: houseSample,
    title: "Quy định mới về đấu giá tài sản có hiệu lực từ tháng 1/2026",
    excerpt: null, source_type: "external", source_name: "VnExpress", source_url: null,
    published_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
    view_count: 19400, read_time_minutes: 3,
    show_on_homepage: true, homepage_position: 2,
    category_id: null, content: null,
    created_at: "", updated_at: "",
    article_categories: { id: "2", name: "Pháp luật", slug: "phap-luat", color: "#3B82F6", created_at: "" },
  },
  {
    id: "3", slug: "", status: "published", author_id: null,
    featured_image_url: penthouseSample,
    title: "TP.HCM đấu giá thành công 4 lô đất Thủ Thiêm đợt 2",
    excerpt: null, source_type: "external", source_name: "Tuổi Trẻ", source_url: null,
    published_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
    view_count: 17800, read_time_minutes: 3,
    show_on_homepage: true, homepage_position: 3,
    category_id: null, content: null,
    created_at: "", updated_at: "",
    article_categories: { id: "1", name: "Kết quả đấu giá", slug: "ket-qua-dau-gia", color: "#10B981", created_at: "" },
  },
  {
    id: "4", slug: "", status: "published", author_id: null,
    featured_image_url: apartmentSample,
    title: "Cẩn trọng với chiêu trò thổi giá tại các phiên đấu giá đất",
    excerpt: null, source_type: "external", source_name: "CafeF", source_url: null,
    published_at: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
    view_count: 20700, read_time_minutes: 4,
    show_on_homepage: true, homepage_position: 4,
    category_id: null, content: null,
    created_at: "", updated_at: "",
    article_categories: { id: "3", name: "Kiến thức", slug: "kien-thuc", color: "#8B5CF6", created_at: "" },
  },
  {
    id: "5", slug: "", status: "published", author_id: null,
    featured_image_url: houseSample,
    title: "Hướng dẫn tham gia đấu giá bất động sản trực tuyến năm 2026",
    excerpt: null, source_type: "original", source_name: null, source_url: null,
    published_at: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
    view_count: 15200, read_time_minutes: 5,
    show_on_homepage: true, homepage_position: 5,
    category_id: null, content: null,
    created_at: "", updated_at: "",
    article_categories: { id: "3", name: "Kiến thức", slug: "kien-thuc", color: "#8B5CF6", created_at: "" },
  },
];

const formatViews = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

function CategoryPill({ category }: { category: ArticleWithCategory["article_categories"] }) {
  if (!category) return null;
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${category.color}20`, color: category.color }}
    >
      {category.name}
    </span>
  );
}

// ─── Featured article (left 3/5) ─────────────────────────────────────────────

function FeaturedCard({ article, onClick }: { article: ArticleWithCategory; onClick: () => void }) {
  return (
    <article className="group cursor-pointer flex flex-col h-full" onClick={onClick}>
      {/* Image */}
      <div className="relative rounded-2xl overflow-hidden aspect-video mb-4 flex-shrink-0">
        <img
          src={article.featured_image_url ?? ""}
          alt={article.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* View count badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md">
          <Eye className="h-3 w-3" />
          <span>{formatViews(article.view_count)}</span>
        </div>
        {/* Category badge on image */}
        {article.article_categories && (
          <div className="absolute top-3 left-3">
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm text-white"
              style={{ backgroundColor: article.article_categories.color }}
            >
              {article.article_categories.name}
            </span>
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex flex-col flex-1 gap-2">
        <h3 className="text-base md:text-lg lg:text-xl font-bold text-foreground line-clamp-3 group-hover:text-primary transition-colors leading-snug">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
        )}
        <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground pt-1">
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

// ─── Text-only stacked article (right 2/5) ───────────────────────────────────

function TextCard({ article, onClick }: { article: ArticleWithCategory; onClick: () => void }) {
  return (
    <article
      className="group cursor-pointer flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0"
      onClick={onClick}
    >
      <CategoryPill category={article.article_categories} />
      <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
        {article.title}
      </h4>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {article.source_type === "external" && article.source_name && (
          <>
            <span className="font-medium text-foreground/60">{article.source_name}</span>
            <span>·</span>
          </>
        )}
        <span>{relativeTime(article.published_at)}</span>
      </div>
    </article>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function FeaturedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3 w-32 mt-1" />
    </div>
  );
}

function TextSkeleton() {
  return (
    <div className="py-4 flex flex-col gap-2 first:pt-0">
      <Skeleton className="h-3 w-20 rounded-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const NewsSection = () => {
  const navigate = useNavigate();
  const { data: liveArticles, isLoading } = useHomepageArticles();

  const articles = liveArticles && liveArticles.length > 0 ? liveArticles : FALLBACK;
  const featured = articles[0];
  const secondary = articles.slice(1, 5);

  const goTo = (a: ArticleWithCategory) => {
    if (a.slug) navigate(`/tin-tuc/${a.slug}`);
  };

  return (
    <section className="container py-6 md:py-10 px-4">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-foreground">Tin tức đấu giá</h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Cập nhật thị trường, kết quả và kiến thức mới nhất
          </p>
        </div>
        <button
          onClick={() => navigate("/tin-tuc")}
          className="hidden sm:flex items-center gap-1 text-sm text-primary font-medium hover:underline underline-offset-4 transition-all shrink-0 ml-4"
        >
          Xem tất cả
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* 1 featured + 4 text-only */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Featured — 3/5 */}
        <div className="lg:col-span-3">
          {isLoading ? <FeaturedSkeleton /> : <FeaturedCard article={featured} onClick={() => goTo(featured)} />}
        </div>

        {/* Text-only stack — 2/5 */}
        <div className="lg:col-span-2 divide-y divide-border">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <TextSkeleton key={i} />)
            : secondary.map((a) => <TextCard key={a.id} article={a} onClick={() => goTo(a)} />)
          }
        </div>
      </div>

      {/* Mobile "Xem tất cả" */}
      <div className="sm:hidden flex justify-center mt-5">
        <button
          onClick={() => navigate("/tin-tuc")}
          className="flex items-center gap-1 text-sm text-primary font-medium"
        >
          Xem tất cả tin tức
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};
