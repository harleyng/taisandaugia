import { cn } from "@/lib/utils";
import { dayMonth, type ActivityItem, type SummaryView } from "@/lib/contracts/detailView";

/** "Tóm tắt hợp đồng": một con số lớn (+ thanh đã thu) và các cặp nhãn – giá trị. */
export function ContractSummaryCard({ view }: { view: SummaryView }) {
  return (
    <section className="rounded-2xl bg-card shadow-card">
      <h2 className="px-[22px] pb-1 pt-5 text-base font-semibold tracking-tight text-foreground">Tóm tắt hợp đồng</h2>
      <div className="border-b px-[22px] pb-4 pt-2.5">
        <small className="block text-[13px] text-muted-foreground">{view.bigLabel}</small>
        <strong className="mt-0.5 block text-[30px] font-extrabold leading-tight tracking-tight tabular-nums text-foreground">
          {view.bigValue}
        </strong>
        {view.progress != null && (
          <>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${view.progress}%` }} />
            </div>
            {view.progressNote && <em className="mt-1.5 block text-[12.5px] not-italic tabular-nums text-muted-foreground">{view.progressNote}</em>}
          </>
        )}
      </div>
      <dl className="px-[22px] pb-2.5 pt-1">
        {view.rows.map((r, i) => (
          <div key={r.label} className={cn("flex justify-between gap-4 py-[11px] text-[13.5px]", i > 0 && "border-t")}>
            <dt className="flex-none text-muted-foreground">{r.label}</dt>
            <dd
              className={cn(
                "min-w-0 text-right font-semibold",
                r.tone === "warn" && "text-warning",
                r.tone === "mono" && "font-mono text-[12.5px]",
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** "Hoạt động": dòng thời gian, mới nhất trên cùng (chấm xanh). */
export function ContractActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-2xl bg-card shadow-card">
      <h2 className="px-[22px] pb-1 pt-5 text-base font-semibold tracking-tight text-foreground">Hoạt động</h2>
      {items.length === 0 ? (
        <p className="px-[22px] pb-5 pt-2 text-[13px] text-muted-foreground">Chưa có hoạt động.</p>
      ) : (
        <ol className="px-[22px] pb-5 pt-2.5">
          {items.map((it, i) => (
            <li
              key={it.key}
              className={cn(
                "relative grid grid-cols-[12px_44px_minmax(0,1fr)] gap-2.5 text-[13.5px]",
                i < items.length - 1 &&
                  "pb-3.5 before:absolute before:bottom-0 before:left-[5px] before:top-3.5 before:w-px before:bg-border",
              )}
            >
              <i
                aria-hidden
                className={cn("mt-1 h-[11px] w-[11px] rounded-full", i === 0 ? "bg-primary" : "bg-card ring-[1.5px] ring-inset ring-border")}
              />
              <span className="pt-px text-[12.5px] tabular-nums text-muted-foreground">{dayMonth(it.at)}</span>
              <span className={i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                {it.text}
                {it.sub && <small className="block text-xs font-normal text-muted-foreground">{it.sub}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
