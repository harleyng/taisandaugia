import { formatMoneyShort } from "@/utils/money";
import type { ReportPayload } from "@/lib/ownerPeriodicReport";
import { reportConclusion, reportSummary } from "@/lib/ownerReportDigest";

/** Màu đoạn "Chờ thu" — sắc nhạt của --primary (không thêm token mới). */
const AWAITING = "bg-primary/35";

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {label} <b className="font-semibold text-foreground">{formatMoneyShort(value)}</b>
    </span>
  );
}

/** "Kết luận kỳ": một câu trả lời (đạt bao nhiêu % chỉ tiêu), thanh tiến độ 3 đoạn và câu tóm tắt. */
export function ReportConclusionHero({ payload }: { payload: ReportPayload }) {
  const { headline, bar } = reportConclusion(payload);
  const summary = reportSummary(payload);

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card px-6 py-[22px] shadow-card">
      <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary">Kết luận kỳ</p>
      <h2 className="max-w-[640px] text-balance text-[22px] font-bold leading-snug tracking-tight text-foreground">
        {headline}
      </h2>
      {bar && (
        <div className="flex flex-col gap-2">
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Đã thu ${formatMoneyShort(bar.collected)}, chờ thu ${formatMoneyShort(bar.awaiting)}, mục tiêu ${formatMoneyShort(bar.target)}`}
          >
            <i className="block h-full bg-primary" style={{ width: `${bar.widths[0]}%` }} />
            <i className={`block h-full ${AWAITING}`} style={{ width: `${bar.widths[1]}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-[12.5px] tabular-nums text-muted-foreground">
            <Legend dot="bg-primary" label="Đã thu" value={bar.collected} />
            {bar.awaiting > 0 && <Legend dot={AWAITING} label="Chờ thu" value={bar.awaiting} />}
            {bar.uncovered > 0 && <Legend dot="bg-border" label="Chưa có nguồn" value={bar.uncovered} />}
          </div>
        </div>
      )}
      <p className="max-w-[760px] text-pretty text-sm leading-relaxed text-foreground">
        {summary.map((p, i) =>
          p.strong ? (
            <b key={i} className="font-semibold">
              {p.text}
            </b>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
    </section>
  );
}
