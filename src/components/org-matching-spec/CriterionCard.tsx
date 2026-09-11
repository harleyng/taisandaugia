import { RichText } from "./RichText";
import { SpecTable } from "./SpecTable";
import type { SpecCopy, SpecCriterion } from "./specContent";

/** Một dòng Input / Xử lý / Output bên trong thẻ tiêu chí. */
function Band({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-1.5 border-b border-border/60 pb-3.5 last:border-b-0 last:pb-0 sm:grid-cols-[84px_minmax(0,1fr)]">
      <span className="pt-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Danh sách gạch đầu dòng dùng chung cho Input và Output. */
function IoList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="relative max-w-[60ch] pl-4 text-sm text-muted-foreground">
          <span aria-hidden className="absolute left-0 top-[0.62em] h-px w-[5px] bg-primary" />
          <RichText text={item} />
        </li>
      ))}
    </ul>
  );
}

interface Props {
  criterion: SpecCriterion;
  labels: SpecCopy["bandLabels"];
}

export function CriterionCard({ criterion, labels }: Props) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-[150px_minmax(0,1fr)]">
        <div>
          <h3 className="mb-3 text-[1.06rem] font-bold leading-tight tracking-tight text-foreground">
            {criterion.title}
          </h3>
          <div className="font-mono text-[2rem] font-bold leading-none tabular-nums text-primary">
            {criterion.weight}
            <span className="ml-1 text-[0.72rem] font-medium text-muted-foreground">{criterion.unit}</span>
          </div>
          <div className="mt-2.5 h-1 max-w-[132px] bg-muted">
            <div className="h-full bg-primary" style={{ width: `${criterion.weight}%` }} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <Band label={labels.input}>
            <IoList items={criterion.inputs} />
          </Band>

          <Band label={labels.process}>
            <div className="flex flex-col gap-2.5">
              {criterion.process.paragraphs.map((p) => (
                <p key={p} className="max-w-[60ch] text-sm text-muted-foreground">
                  <RichText text={p} />
                </p>
              ))}
              {criterion.process.formula && (
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 px-4 py-3 font-mono text-[0.8rem] leading-relaxed text-foreground">
                  {criterion.process.formula}
                </pre>
              )}
              {criterion.process.table && <SpecTable table={criterion.process.table} />}
            </div>
          </Band>

          <Band label={labels.output}>
            <IoList items={criterion.outputs} />
          </Band>
        </div>
      </div>
    </article>
  );
}
