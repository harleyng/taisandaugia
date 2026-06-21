-- CMS: article_categories + articles tables for news/blog content
-- Admin-only write access; published articles are publicly readable.

-- ─── article_categories ──────────────────────────────────────────────────────

CREATE TABLE public.article_categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT article_categories_slug_unique UNIQUE (slug)
);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "article_categories_public_read"
  ON public.article_categories FOR SELECT
  USING (true);

CREATE POLICY "article_categories_admin_all"
  ON public.article_categories FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Seed default categories
INSERT INTO public.article_categories (name, slug, color) VALUES
  ('Kết quả đấu giá', 'ket-qua-dau-gia', '#10B981'),
  ('Pháp luật',        'phap-luat',       '#3B82F6'),
  ('Kiến thức',        'kien-thuc',       '#8B5CF6'),
  ('Thị trường',       'thi-truong',      '#F59E0B');

-- ─── articles ────────────────────────────────────────────────────────────────

CREATE TABLE public.articles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT        NOT NULL,
  slug                TEXT        NOT NULL,
  excerpt             TEXT,
  content             TEXT,
  featured_image_url  TEXT,
  category_id         UUID        REFERENCES public.article_categories(id) ON DELETE SET NULL,
  author_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status              TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at        TIMESTAMPTZ,
  view_count          INTEGER     NOT NULL DEFAULT 0,
  read_time_minutes   INTEGER,
  source_name         TEXT,
  source_url          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT articles_slug_unique UNIQUE (slug)
);

CREATE INDEX idx_articles_status_published_at ON public.articles (status, published_at DESC);
CREATE INDEX idx_articles_category_id         ON public.articles (category_id);
CREATE INDEX idx_articles_slug                ON public.articles (slug);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published articles
CREATE POLICY "articles_public_read"
  ON public.articles FOR SELECT
  USING (status = 'published');

-- Admins have full access
CREATE POLICY "articles_admin_all"
  ON public.articles FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- updated_at auto-maintained
CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
