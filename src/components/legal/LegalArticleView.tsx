import { useMemo } from "react";

interface Props {
  content: string | null | undefined;
  isLoading?: boolean;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Render nội dung văn bản pháp lý (HTML từ rich-text) + mục lục tự động sinh từ
 * các thẻ H2 (gán id nếu thiếu). Dùng chung cho trang Điều khoản & Chính sách.
 */
export function LegalArticleView({ content, isLoading }: Props) {
  const { html, toc } = useMemo(() => {
    if (!content) return { html: "", toc: [] as Array<{ id: string; text: string }> };
    // DOMParser chỉ có ở trình duyệt — app là SPA client-only nên an toàn.
    const doc = new DOMParser().parseFromString(content, "text/html");
    const toc: Array<{ id: string; text: string }> = [];
    doc.querySelectorAll("h2").forEach((h, i) => {
      const text = h.textContent?.trim() || `Mục ${i + 1}`;
      let id = h.getAttribute("id");
      if (!id) {
        id = slugify(text) || `muc-${i + 1}`;
        h.setAttribute("id", id);
      }
      toc.push({ id, text });
    });
    return { html: doc.body.innerHTML, toc };
  }, [content]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-1/3 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-11/12 rounded bg-muted" />
        <div className="h-4 w-4/5 rounded bg-muted" />
      </div>
    );
  }

  if (!content) {
    return <p className="italic text-muted-foreground">Chưa có nội dung.</p>;
  }

  const body = (
    <div
      className="article-body text-sm leading-relaxed text-muted-foreground [&_h2]:scroll-mt-24 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );

  if (toc.length === 0) return body;

  return (
    <div className="flex flex-col gap-10 lg:flex-row">
      <aside className="flex-shrink-0 lg:w-56">
        <div className="sticky top-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mục lục
          </h2>
          <nav className="flex flex-col gap-1">
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t.text}
              </a>
            ))}
          </nav>
        </div>
      </aside>
      <article className="flex-1">{body}</article>
    </div>
  );
}
