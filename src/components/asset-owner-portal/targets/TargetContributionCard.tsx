import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RECOVERY_SEGMENTS } from "@/components/asset-owner-portal/overview/recoverySegments";
import type { WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";
import { shortAssetId } from "@/lib/ownerAssetId";
import type { OutcomeOverviewRow } from "@/lib/ownerOutcomesOverview";
import { pageWindow } from "@/lib/ownerOutcomesLedger";
import { formatDayFull } from "@/lib/ownerPulse";
import {
  TARGET_METRIC_META,
  formatMetricValue,
  type CriterionBreakdown,
  type CriterionProgress,
  type RecoverySummary,
  type TargetTiming,
} from "@/lib/ownerTargets";
import {
  CONTRIBUTION_PAGE_SIZE,
  CONTRIBUTION_PAYMENT_LABEL,
  contributionOutcomeLabel,
  contributionPayment,
  shortBranchLabel,
  type ContributionPayment,
} from "@/lib/ownerTargetView";
import { formatMoneyShort } from "@/utils/money";
import { HAIRLINE } from "./targetStyles";

// Chữ vàng trên nền trắng không đủ tương phản ⇒ "Chưa thu" giữ màu chữ chính, thêm chấm vàng.
const PAYMENT_TEXT: Record<ContributionPayment, string> = {
  paid: "text-primary",
  partial: "text-foreground",
  pending: "text-foreground",
  estimated: "text-muted-foreground",
  defaulted: "text-destructive",
};

const TH = "whitespace-nowrap border-b px-3.5 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground first:pl-[22px] last:pr-[22px]";
const TD = "border-b px-3.5 py-3 align-top first:pl-[22px] last:pr-[22px]";
const PAGE_BTN = cn(
  "grid h-8 min-w-8 place-items-center rounded-lg bg-card px-2 text-[13px] font-semibold tabular-nums transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card",
  HAIRLINE,
);

/** Đã ghi nhận thu · tạm tính · đã bán chờ thu — tỉ lệ trên tổng của cả ba. */
function RecoverySplit({ summary }: { summary: Pick<RecoverySummary, "recorded" | "estimated" | "awaiting"> }) {
  const all = summary.recorded + summary.estimated + summary.awaiting || 1;
  const legend: Record<string, string> = {
    recorded: "Đã ghi nhận thu",
    estimated: "Tạm tính theo giá trúng",
    awaiting: "Đã bán, chờ thu",
  };
  return (
    <div className="flex flex-col gap-2.5 border-b bg-muted/40 px-[22px] py-3.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
        {RECOVERY_SEGMENTS.map((s) => (
          <i key={s.key} className={cn("block h-full", s.className)} style={{ ...s.style, width: `${(summary[s.key] / all) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-[22px] gap-y-1.5 text-[13px] tabular-nums text-muted-foreground">
        {RECOVERY_SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <i aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", s.className)} style={s.style} />
            {legend[s.key]} <b className="font-[650] text-foreground">{formatMoneyShort(summary[s.key])}</b>
            {s.key === "awaiting" && " — chưa tính"}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface TargetContributionCardProps {
  criterion: CriterionProgress;
  breakdown: CriterionBreakdown;
  summary: RecoverySummary;
  /** Dòng Kết quả phiên theo row_key — tên và mã tài sản. */
  rowsByKey: Map<string, OutcomeOverviewRow>;
  /** Có ⇒ thêm cột chi nhánh (chỉ tiêu cả đơn vị của đơn vị có chi nhánh). */
  branches: WorkspaceBranchOption[] | null;
  scopeLabel: string;
  timing: TargetTiming;
}

/**
 * "Số liệu cấu thành" của tiêu chí đang chọn: tổng ở đầu thẻ, thanh chia tiền (tiêu chí
 * thu hồi), bảng từng tài sản 5 dòng/trang; dòng Tổng = số thực tế trên thẻ tiêu chí.
 * Trang về 1 khi đổi tiêu chí (trang cha key theo tiêu chí).
 */
export function TargetContributionCard({
  criterion,
  breakdown,
  summary,
  rowsByKey,
  branches,
  scopeLabel,
  timing,
}: TargetContributionCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState(1);
  const { metric } = criterion;
  const meta = TARGET_METRIC_META[metric];
  const isMoney = meta.unit === "money";
  const showOutcome = metric === "offered_count";
  const showPayment = metric === "recovered_amount";
  // Tổng giá trúng: phần góp chính là giá trúng ⇒ không lặp cột.
  const showPrice = metric !== "winning_total";
  const { rows, total } = breakdown;

  const pages = Math.max(1, Math.ceil(rows.length / CONTRIBUTION_PAGE_SIZE));
  const current = Math.min(page, pages);
  const from = (current - 1) * CONTRIBUTION_PAGE_SIZE;
  const leadCols = 2 + Number(!!branches) + Number(showOutcome) + Number(showPrice) + Number(showPayment);
  const count = (n: number) => n.toLocaleString("en-US");

  const goTo = (n: number) => {
    setPage(n);
    const el = cardRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  };

  return (
    <section
      ref={cardRef}
      aria-label={`Số liệu cấu thành · ${meta.label}`}
      className="overflow-hidden rounded-2xl bg-card shadow-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b px-[22px] py-[18px]">
        <div className="min-w-0">
          <h3 className="text-[15px] font-[650] text-foreground">Số liệu cấu thành · {meta.label}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {meta.hint} · {scopeLabel}
          </p>
        </div>
        {rows.length > 0 && (
          <div className="text-right tabular-nums">
            <strong className="block text-[22px] font-bold tracking-[-0.01em] text-foreground">
              {formatMetricValue(metric, total)}
            </strong>
            <small className="text-[12.5px] text-muted-foreground">
              {count(rows.length)} tài sản · mục tiêu {formatMetricValue(metric, criterion.goal)}
            </small>
          </div>
        )}
      </header>

      {!rows.length ? (
        <div className="p-9 text-center text-sm text-muted-foreground">
          <b className="mb-1 block text-[15px] text-foreground">
            {timing === "upcoming" ? "Kỳ chưa bắt đầu" : "Chưa có tài sản nào góp vào tiêu chí này"}
          </b>
          {timing === "upcoming"
            ? "Số liệu cộng dần khi có kết quả phiên trong kỳ."
            : "Kết quả phiên có ngày phiên trong kỳ sẽ hiện ở đây."}
        </div>
      ) : (
        <>
          {showPayment && <RecoverySplit summary={summary} />}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th className={TH}>Tài sản</th>
                  <th className={TH}>Ngày phiên</th>
                  {branches && <th className={TH}>Chi nhánh</th>}
                  {showOutcome && <th className={TH}>Kết quả</th>}
                  {showPrice && <th className={cn(TH, "text-right")}>Giá trúng</th>}
                  {showPayment && <th className={TH}>Thu tiền</th>}
                  {isMoney && (
                    <th className={cn(TH, "text-right")}>{showPayment ? "Góp vào thu hồi" : "Giá trúng"}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.slice(from, from + CONTRIBUTION_PAGE_SIZE).map(({ input, value }) => {
                  const row = rowsByKey.get(input.key);
                  const pay = contributionPayment(input);
                  return (
                    <tr key={input.key} className="[&:hover>td]:bg-muted/40">
                      <td className={TD}>
                        <b className="block max-w-[340px] font-semibold text-foreground">{row?.title ?? "Tài sản"}</b>
                        <small className="mt-[3px] flex items-center gap-2 text-xs text-muted-foreground">
                          {row?.listingId ? (
                            <span
                              className="rounded-[5px] bg-muted px-1.5 py-px font-mono text-[11.5px] text-foreground"
                              title="Mã tài sản"
                            >
                              {shortAssetId(row.listingId)}
                            </span>
                          ) : (
                            <span>Ngoài sàn</span>
                          )}
                        </small>
                      </td>
                      <td className={cn(TD, "whitespace-nowrap tabular-nums")}>
                        {input.day ? formatDayFull(input.day) : "—"}
                      </td>
                      {branches && (
                        <td className={TD}>
                          {shortBranchLabel(branches.find((b) => b.id === input.branchId)?.label ?? "—")}
                        </td>
                      )}
                      {showOutcome && (
                        <td className={TD}>
                          <span
                            className={cn(
                              "whitespace-nowrap text-[12.5px] font-semibold",
                              input.outcome !== "sold"
                                ? "text-muted-foreground"
                                : input.paymentStatus === "defaulted"
                                  ? "text-destructive"
                                  : "text-primary",
                            )}
                          >
                            {contributionOutcomeLabel(input)}
                          </span>
                        </td>
                      )}
                      {showPrice && (
                        <td className={cn(TD, "whitespace-nowrap text-right tabular-nums")}>
                          {input.outcome === "sold" && input.price ? formatMoneyShort(input.price) : "—"}
                        </td>
                      )}
                      {showPayment && (
                        <td className={TD}>
                          <span className={cn("whitespace-nowrap text-[12.5px] font-semibold", PAYMENT_TEXT[pay])}>
                            {pay === "pending" && (
                              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warning align-middle" aria-hidden="true" />
                            )}
                            {CONTRIBUTION_PAYMENT_LABEL[pay]}
                            {pay === "partial" && (
                              <small className="block font-medium tabular-nums text-muted-foreground">
                                {formatMoneyShort(input.paidAmount)} / {formatMoneyShort(input.price)}
                              </small>
                            )}
                          </span>
                        </td>
                      )}
                      {isMoney && (
                        <td
                          className={cn(
                            TD,
                            "whitespace-nowrap text-right font-semibold tabular-nums",
                            !value && "text-muted-foreground",
                          )}
                        >
                          {formatMoneyShort(value)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-bold">
                  <td colSpan={leadCols} className={cn(TD, "border-b-0")}>
                    Tổng · {count(rows.length)} tài sản
                  </td>
                  {isMoney && (
                    <td className={cn(TD, "whitespace-nowrap border-b-0 text-right tabular-nums")}>
                      {formatMetricValue(metric, total)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {pages > 1 && (
            <nav
              aria-label="Phân trang"
              className="flex flex-wrap items-center justify-between gap-3 border-t px-[22px] py-3 text-[13px] text-muted-foreground"
            >
              <span className="tabular-nums">
                {from + 1}–{Math.min(from + CONTRIBUTION_PAGE_SIZE, rows.length)} / {count(rows.length)} tài sản
              </span>
              <div className="flex gap-1">
                <button type="button" className={PAGE_BTN} disabled={current === 1} onClick={() => goTo(current - 1)} aria-label="Trang trước">
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                </button>
                {pageWindow(current, pages).map((n, i) =>
                  n === null ? (
                    <span key={`gap-${i}`} className="grid h-8 min-w-8 place-items-center">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      type="button"
                      aria-current={n === current ? "page" : undefined}
                      className={cn(PAGE_BTN, n === current && "bg-foreground text-background shadow-none hover:bg-foreground")}
                      onClick={() => goTo(n)}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button type="button" className={PAGE_BTN} disabled={current === pages} onClick={() => goTo(current + 1)} aria-label="Trang sau">
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
