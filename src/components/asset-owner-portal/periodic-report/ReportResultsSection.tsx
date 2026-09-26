import { AlertTriangle, Gavel } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OUTCOME_KIND_LABEL } from "@/lib/ownerOutcomes";
import {
  REPORT_PAYMENT_LABEL,
  formatReportDay,
  type ReportPayload,
  type ReportResultItem,
  type ReportResultLabel,
} from "@/lib/ownerPeriodicReport";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import { AssetCell, ReportTable, type ReportColumn, type ReportVariant } from "./ReportTable";
import { ReportSourceLabel } from "./ReportSourceLabel";

function OutcomeCell({ i }: { i: ReportResultItem }) {
  if (!i.outcome) return <>—</>;
  return (
    <div>
      <p>{OUTCOME_KIND_LABEL[i.outcome]}</p>
      {i.outcome === "sold" && i.paymentStatus && (
        <p className="text-[11px] text-muted-foreground">{REPORT_PAYMENT_LABEL[i.paymentStatus]}</p>
      )}
    </div>
  );
}

function itemColumns(variant: ReportVariant): ReportColumn<ReportResultItem>[] {
  return [
    {
      label: "Tài sản",
      render: (i) => <AssetCell title={i.title} code={i.assetCode} branchName={i.branchName} />,
      className: "w-[34%]",
    },
    { label: "Ngày đấu", render: (i) => formatReportDay(i.date), numeric: true },
    { label: "Kết quả", render: (i) => <OutcomeCell i={i} /> },
    { label: "Giá khởi điểm", render: (i) => formatMoneyFull(i.startingPrice), numeric: true },
    { label: "Giá trúng", render: (i) => (i.outcome === "sold" ? formatMoneyFull(i.price) : "—"), numeric: true },
    {
      label: "Nguồn",
      render: (i) => <ReportSourceLabel confidence={i.confidence} hasConflict={i.hasConflict} variant={variant} />,
    },
  ];
}

function labelColumns(variant: ReportVariant): ReportColumn<ReportResultLabel>[] {
  return [
    { label: "Nguồn số liệu", render: (g) => <ReportSourceLabel confidence={g.label} variant={variant} /> },
    { label: "Tài sản", render: (g) => g.count, numeric: true },
    { label: "Thành", render: (g) => g.sold, numeric: true },
    { label: "Giá trúng", render: (g) => formatMoneyFull(g.soldValue), numeric: true },
  ];
}

/** Phần 2 — kết quả phiên có ngày đấu trong kỳ; mỗi con số kèm nguồn. */
export function ReportResultsSection({ payload, variant }: { payload: ReportPayload; variant: ReportVariant }) {
  const { totals, byLabel, items } = payload.results;

  return (
    <SectionCard title="2. Kết quả phiên trong kỳ" icon={Gavel} count={totals.total}>
      {totals.total === 0 ? (
        <EmptyState compact icon={Gavel} tone="muted" title="Kỳ này chưa có tài sản nào có kết quả phiên." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 print:grid-cols-4 print:[&_p]:whitespace-normal">
            <StatTile
              label="Thành"
              value={String(totals.sold)}
              context={`tổng giá trúng ${formatMoneyShort(totals.soldValue)}${
                totals.soldWithoutPrice ? ` · ${totals.soldWithoutPrice} chưa rõ giá` : ""
              }`}
            />
            <StatTile label="Không thành" value={String(totals.unsold)} context="cần đấu lại" />
            <StatTile label="Hoãn / Huỷ / Rút" value={String(totals.voided)} context="phiên không diễn ra" />
            <StatTile
              label="Tỷ lệ thành công"
              value={totals.successRate === null ? "—" : String(totals.successRate)}
              unit={totals.successRate === null ? undefined : "%"}
              icon={totals.conflicts ? AlertTriangle : undefined}
              tone={totals.conflicts ? "warning" : undefined}
              context={
                totals.conflicts ? `${totals.conflicts} tài sản lệch số liệu giữa các nguồn` : `trên ${totals.total} tài sản`
              }
            />
          </div>

          {totals.defaulted > 0 && (
            <p className="text-xs text-muted-foreground">
              Trong số tài sản thành có {totals.defaulted} tài sản người trúng bỏ cọc.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Theo nguồn số liệu</p>
            <ReportTable columns={labelColumns(variant)} rows={byLabel} rowKey={(g) => g.label} variant={variant} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Chi tiết từng tài sản</p>
            <ReportTable
              columns={itemColumns(variant)}
              rows={items}
              rowKey={(i, idx) => `${i.assetCode ?? i.title}-${idx}`}
              variant={variant}
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}
