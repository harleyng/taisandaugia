import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CriterionCard } from "@/components/org-matching-spec/CriterionCard";
import { PipelineSteps } from "@/components/org-matching-spec/PipelineSteps";
import { RichText } from "@/components/org-matching-spec/RichText";
import { SpecTable } from "@/components/org-matching-spec/SpecTable";
import { WeightBar } from "@/components/org-matching-spec/WeightBar";
import {
  SPEC_CONTENT,
  SPEC_LANGS,
  specSections,
  type SpecLang,
  type SpecSectionMeta,
} from "@/components/org-matching-spec/specContent";

const LANG_LABELS: Record<SpecLang, string> = { vi: "Tiếng Việt", en: "English" };

/** Tiêu đề mục — số thứ tự là thông tin thật, các mục đọc theo đúng thứ tự này. */
function SectionHead({ meta }: { meta: SpecSectionMeta }) {
  return (
    <>
      <h2 className="mb-1.5 flex items-baseline gap-3 text-2xl font-bold tracking-tight text-foreground">
        <span className="font-mono text-xs font-bold text-primary">{meta.num}</span>
        {meta.title}
      </h2>
      <p className="mb-6 max-w-[68ch] text-muted-foreground">
        <RichText text={meta.lede} />
      </p>
    </>
  );
}

/**
 * Trang công khai "Thuật toán khớp tổ chức đấu giá".
 *
 * NGÔN NGỮ NẰM TRÊN URL (?lang=en) chứ không phải state cục bộ hay localStorage:
 * người đọc gửi đường dẫn cho đồng nghiệp nước ngoài thì bản tiếng Anh phải mở
 * đúng bản tiếng Anh. Neo của các mục giống nhau ở hai bản nên đổi ngôn ngữ
 * không làm hỏng liên kết #.
 */
const OrgMatchingSpec = () => {
  const [params, setParams] = useSearchParams();
  const lang: SpecLang = params.get("lang") === "en" ? "en" : "vi";
  const copy = SPEC_CONTENT[lang];
  const sections = specSections(copy);

  const switchLang = (next: SpecLang) => {
    const p = new URLSearchParams(params);
    if (next === "vi") p.delete("lang");
    else p.set("lang", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-foreground text-background">
        <div className="container max-w-5xl px-4 py-14 md:py-20">
          <div className="mb-6 flex w-max overflow-hidden rounded-lg border border-background/20">
            {SPEC_LANGS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={l === lang}
                onClick={() => switchLang(l)}
                className={`px-3.5 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] transition-colors ${
                  l === lang ? "bg-background text-foreground" : "text-background/60 hover:text-background"
                }`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>

          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-background/50">{copy.eyebrow}</p>
          <h1 className="mb-4 text-3xl font-bold leading-tight md:text-4xl">{copy.title}</h1>
          <p className="mb-8 max-w-[58ch] text-sm leading-relaxed text-background/70 md:text-base">
            {copy.standfirst}
          </p>
          <dl className="flex flex-wrap gap-x-8 gap-y-1 font-mono text-[11.5px] text-background/50">
            {copy.meta.map((m) => (
              <div key={m.label} className="flex gap-1.5">
                <dt>{m.label} ·</dt>
                <dd className="text-background/80">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="container max-w-5xl px-4 py-12 md:py-16 lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-14">
        {/* Mục lục */}
        <nav aria-label={copy.tocLabel} className="hidden lg:block">
          <div className="sticky top-7">
            <p className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[0.13em] text-muted-foreground">
              {copy.tocLabel}
            </p>
            <ol className="flex flex-col gap-2.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block border-l-2 border-border pl-3 text-[13px] font-medium leading-snug text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <main className="min-w-0">
          {/* Cảnh báo dữ liệu — đứng trước mọi con số trong trang, có lý do */}
          <div className="mb-12 rounded-2xl border-l-4 border-warning bg-warning/10 px-5 py-4">
            <h2 className="mb-1.5 text-[0.94rem] font-bold text-foreground">{copy.notice.title}</h2>
            <p className="max-w-[64ch] text-sm text-muted-foreground">
              <RichText text={copy.notice.body} />
            </p>
          </div>

          <section id={copy.pipeline.id} className="mb-16 scroll-mt-24">
            <SectionHead meta={copy.pipeline} />
            <PipelineSteps stages={copy.pipeline.stages} />
          </section>

          <section id={copy.attrs.id} className="mb-16 scroll-mt-24">
            <SectionHead meta={copy.attrs} />
            <SpecTable table={copy.attrs.table} />
            <p className="mt-4 text-sm text-muted-foreground">
              <RichText text={copy.attrs.note} />
            </p>
          </section>

          <section id={copy.criteria.id} className="mb-16 scroll-mt-24">
            <SectionHead meta={copy.criteria} />
            <div className="flex flex-col gap-4">
              {copy.criteria.items.map((item) => (
                <CriterionCard key={item.title} criterion={item} labels={copy.bandLabels} />
              ))}
            </div>
          </section>

          <section id={copy.total.id} className="mb-16 scroll-mt-24">
            <SectionHead meta={copy.total} />
            <WeightBar bars={copy.total.bars} alt={copy.total.barsAlt} />
            <div className="flex flex-col gap-3">
              {copy.total.paragraphs.map((p) => (
                <p key={p} className="max-w-[68ch] text-muted-foreground">
                  <RichText text={p} />
                </p>
              ))}
            </div>
          </section>

          <section id={copy.example.id} className="mb-16 scroll-mt-24">
            <SectionHead meta={copy.example} />
            <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <h3 className="mb-1 text-[0.95rem] font-semibold text-foreground">{copy.example.caseTitle}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{copy.example.given}</p>
              <SpecTable table={copy.example.table} />
            </div>
          </section>

          <footer className="border-t border-border pt-5">
            <p className="max-w-[70ch] font-mono text-[11px] leading-relaxed text-muted-foreground">
              {copy.footerNote}
            </p>
          </footer>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default OrgMatchingSpec;
