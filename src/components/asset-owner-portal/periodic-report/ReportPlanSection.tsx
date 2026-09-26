import { AlertTriangle, CalendarClock } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { periodLabel } from "@/lib/ownerTargets";
import { formatReportDay, type ReportPayload, type ReportScheduledItem } from "@/lib/ownerPeriodicReport";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import { AssetCell, ReportTable, type ReportColumn, type ReportVariant } from "./ReportTable";

const COLUMNS: ReportColumn<ReportScheduledItem>[] = [
  {
    label: "Tài sản",
    render: (i) => (
      <div className="space-y-0.5">
        <AssetCell title={i.title} code={i.assetCode} branchName={i.branchName} />
        {i.isStuck && (
          <p className="flex items-center gap-1 text-[11px] text-foreground">
            <AlertTriangle className="h-3 w-3 shrink-0 text-warning" strokeWidth={1.5} aria-hidden="true" />
            Đang tồn đọng
          </p>
        )}
      </div>
    ),
    className: "w-[36%]",
  },
  { label: "Ngày đấu", render: (i) => formatReportDay(i.date), numeric: true },
  { label: "Tổ chức đấu giá", render: (i) => i.orgName ?? "—" },
  { label: "Giá khởi điểm", render: (i) => formatMoneyFull(i.startingPrice), numeric: true },
  { label: "Lịch theo", render: (i) => (i.source === "platform" ? "Phiên trên sàn" : "Tin đăng") },
];

/** Phần 5 — chỉ tiêu kỳ tới, các phiên đã lên lịch và kế hoạch cán bộ tự viết. */
export function ReportPlanSection({ payload, variant }: { payload: ReportPayload; variant: ReportVariant }) {
  const { nextPeriod, nextTargets, scheduled, stuckUnscheduled } = payload.plan;
  const nextLabel = nextPeriod ? periodLabel(nextPeriod.type, nextPeriod.start) : "kỳ tới";

  return (
    <SectionCard title="5. Kế hoạch kỳ tới" icon={CalendarClock}>
      <div className="space-y-4">
        <div className="space-y-1 text-sm">
          <p className="text-foreground">
            <span className="font-medium">{nextLabel.charAt(0).toUpperCase() + nextLabel.slice(1)}</span>
            {nextPeriod && (
              <span className="text-muted-foreground">
                {" "}
                · {formatReportDay(nextPeriod.start)} – {formatReportDay(nextPeriod.end)}
              </span>
            )}
          </p>
          {nextTargets.length ? (
            nextTargets.map((t, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                Chỉ tiêu {t.scope === "unit" ? "toàn đơn vị" : t.branchName ?? "chi nhánh"}:{" "}
                {[
                  t.targetAmount !== null ? `thu hồi ${formatMoneyShort(t.targetAmount)}` : null,
                  t.targetCount !== null ? `${t.targetCount} tài sản đấu thành` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Chưa đặt chỉ tiêu cho {nextLabel}.</p>
          )}
        </div>

        {payload.notes.plan && (
          <div className="break-inside-avoid rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Kế hoạch của đơn vị</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{payload.notes.plan}</p>
          </div>
        )}

        {stuckUnscheduled > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" strokeWidth={1.5} aria-hidden="true" />
            {stuckUnscheduled} tài sản tồn đọng chưa có lịch đấu lại.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Phiên đã lên lịch tới hết {nextLabel}</p>
          {scheduled.length ? (
            <ReportTable
              columns={COLUMNS}
              rows={scheduled}
              rowKey={(i, idx) => `${i.assetCode ?? i.title}-${idx}`}
              variant={variant}
            />
          ) : (
            <EmptyState compact icon={CalendarClock} tone="muted" title="Chưa có phiên nào được lên lịch." />
          )}
        </div>
      </div>
    </SectionCard>
  );
}
