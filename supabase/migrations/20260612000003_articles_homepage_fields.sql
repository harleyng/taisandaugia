-- Add homepage display controls to articles
-- show_on_homepage: whether this article appears in the homepage NewsSection
-- homepage_position: explicit slot (1=featured, 2-3=side cards, 4-5=compact list)
--   NULL = auto-ordered by published_at among homepage articles

ALTER TABLE public.articles
  ADD COLUMN show_on_homepage  BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN homepage_position SMALLINT CHECK (homepage_position BETWEEN 1 AND 5);

CREATE INDEX idx_articles_homepage
  ON public.articles (show_on_homepage, homepage_position ASC NULLS LAST, published_at DESC)
  WHERE show_on_homepage = true;
