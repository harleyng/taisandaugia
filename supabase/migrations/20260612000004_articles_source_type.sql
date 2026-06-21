-- Distinguish platform-authored articles from externally sourced reposts
ALTER TABLE public.articles
  ADD COLUMN source_type TEXT NOT NULL DEFAULT 'original'
    CHECK (source_type IN ('original', 'external'));
