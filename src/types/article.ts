export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  created_at: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image_url: string | null;
  category_id: string | null;
  author_id: string | null;
  status: "draft" | "published";
  published_at: string | null;
  view_count: number;
  read_time_minutes: number | null;
  source_type: "original" | "external";
  source_name: string | null;
  source_url: string | null;
  show_on_homepage: boolean;
  homepage_position: number | null;
  created_at: string;
  updated_at: string;
  // joined
  article_categories?: ArticleCategory | null;
}

export interface ArticleWithCategory extends Article {
  article_categories: ArticleCategory | null;
}
