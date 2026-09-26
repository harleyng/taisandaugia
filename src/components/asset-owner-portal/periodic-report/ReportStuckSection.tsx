import { Clock } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OUTCOME_KIND_LABEL } from "@/lib/ownerOutcomes";
import { formatReportDay, type ReportPayload, type ReportStuckItem } from "@/lib/ownerPeriodicReport";
import { formatMoneyFull } from "@/utils/money";
import { AssetCell, ReportTable, type ReportColumn, type ReportVariant } from "./ReportTable";

const COLUMNS: ReportColumn<ReportStuckItem>[] = [
  {
    label: "Tài sản",
    render: (i) => <AssetCell title={i.title} code={i.assetCode} branchName={i.branchName} />,
    className: "w-[34%]",
  },
  { label: "Số lượt", render: (i) => i.rounds, numeric: true },
  { label: "Số ngày", render: (i) => i.ageDays ?? "—", numeric: true },
  {
    label: "Kết quả gần nhất",
    render: (i) =>
      i.lastOutcome ? `${OUTCOME_KIND_LABEL[i.lastOutcome]} · ${formatReportDay(i.lastDate)}` : "Chưa có kết quả",
  },
  { label: "Giá khởi điểm", render: (i) => formatMoneyFull(i.startingPrice), numeric: true },
  { label: "Phiên tới", render: (i) => (i.nextDate ? formatReportDay(i.nextDate) : "Chưa có lịch"), numeric: true },
];

/** Phần 4 — tài sản tồn đọng tính đến ngày lập (§A5: ≥ 3 lượt hoặc > 90 ngày, chưa bán). */
export function ReportStuckSection({ payload, variant }: { payload: ReportPayload; variant: ReportVariant }) {
  const { rule, count, items } = payload.stuck;
  return (
    <SectionCard title="4. Tài sản tồn đọng" icon={Clock} tone={count ? "warning" : "primary"} count={count}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Chưa bán sau từ {rule.minRounds} lượt đấu, hoặc đã hơn {rule.maxDays} ngày kể từ lần đầu đưa ra đấu giá — tính
          đến {formatReportDay(payload.meta.asOf)}.
        </p>
        {items.length ? (
          <ReportTable
            columns={COLUMNS}
            rows={items}
            rowKey={(i, idx) => `${i.assetCode ?? i.title}-${idx}`}
            variant={variant}
          />
        ) : (
          <EmptyState compact icon={Clock} tone="success" title="Không có tài sản tồn đọng — tốt lắm." />
        )}
      </div>
    </SectionCard>
  );
}
