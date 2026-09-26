import { AlertTriangle, Clock, Wallet } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import {
  REPORT_PAYMENT_LABEL,
  formatReportDay,
  type ReportMoneyItem,
  type ReportMoneyLabel,
  type ReportPayload,
} from "@/lib/ownerPeriodicReport";
import { formatMoneyFull, formatMoneyShort, moneyShortParts } from "@/utils/money";
import { AssetCell, ReportTable, type ReportColumn, type ReportVariant } from "./ReportTable";
import { ReportSourceLabel } from "./ReportSourceLabel";

function itemColumns(variant: ReportVariant): ReportColumn<ReportMoneyItem>[] {
  return [
    {
      label: "Tài sản",
      render: (i) => <AssetCell title={i.title} code={i.assetCode} branchName={i.branchName} />,
      className: "w-[32%]",
    },
    { label: "Ngày đấu", render: (i) => formatReportDay(i.date), numeric: true },
    { label: "Giá trúng", render: (i) => formatMoneyFull(i.price), numeric: true },
    { label: "Đã thu", render: (i) => (i.paidAmount ? formatMoneyFull(i.paidAmount) : "—"), numeric: true },
    { label: "Chờ thu", render: (i) => (i.awaiting ? formatMoneyFull(i.awaiting) : "—"), numeric: true },
    {
      label: "Tình trạng · nguồn",
      render: (i) => (
        <div className="space-y-1">
          <p className="flex items-center gap-1">
            {i.paymentStatus === "defaulted" && (
              <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" strokeWidth={1.5} aria-hidden="true" />
            )}
            {i.paymentStatus ? REPORT_PAYMENT_LABEL[i.paymentStatus] : "—"}
          </p>
          <ReportSourceLabel confidence={i.confidence} variant={variant} />
        </div>
      ),
    },
  ];
}

function labelColumns(variant: ReportVariant): ReportColumn<ReportMoneyLabel>[] {
  return [
    { label: "Nguồn số liệu", render: (g) => <ReportSourceLabel confidence={g.label} variant={variant} /> },
    { label: "Tài sản", render: (g) => g.count, numeric: true },
    { label: "Đã thu", render: (g) => formatMoneyFull(g.collected), numeric: true },
    { label: "Chờ thu", render: (g) => formatMoneyFull(g.awaiting), numeric: true },
  ];
}

/** Phần 3 — tiền của các tài sản đấu thành trong kỳ: đã thu / chờ thu / bỏ cọc (luật "Đã thu" của Chỉ tiêu). */
export function ReportMoneySection({ payload, variant }: { payload: ReportPayload; variant: ReportVariant }) {
  const m = payload.money;
  const collected = moneyShortParts(m.collected);
  const awaiting = moneyShortParts(m.awaiting);
  const carry = moneyShortParts(m.carryOver.awaiting);
  const hasSold = m.soldCount > 0 || m.defaulted.count > 0;

  return (
    <SectionCard title="3. Tiền thu" icon={Wallet}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 print:grid-cols-4 print:[&_p]:whitespace-normal">
          <StatTile
            label="Đã thu trong kỳ"
            value={collected.value}
            unit={collected.unit}
            context={`ghi nhận ${formatMoneyShort(m.recorded)} · tạm tính ${formatMoneyShort(m.estimated)}`}
          />
          <StatTile
            label="Chờ thu"
            value={awaiting.value}
            unit={awaiting.unit}
            icon={m.awaiting > 0 ? Clock : undefined}
            tone="warning"
            context="đã bán, tiền chưa về đủ"
          />
          <StatTile
            label="Người trúng bỏ cọc"
            value={String(m.defaulted.count)}
            icon={m.defaulted.count ? AlertTriangle : undefined}
            tone="destructive"
            context={m.defaulted.count ? `giá trúng ${formatMoneyShort(m.defaulted.value)}` : "không có"}
          />
          <StatTile
            label="Chờ thu từ kỳ trước"
            value={carry.value}
            unit={carry.unit}
            context={`${m.carryOver.count} tài sản, tính đến ${formatReportDay(payload.meta.asOf)}`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Đã thu = số đơn vị đã ghi nhận thu; nguồn không theo dõi thu tiền (tổ chức tự khai, tin đăng) tạm tính bằng
          giá trúng. Tài sản người trúng bỏ cọc không được tính.
        </p>

        {hasSold ? (
          <>
            {m.byLabel.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Theo nguồn số liệu</p>
                <ReportTable columns={labelColumns(variant)} rows={m.byLabel} rowKey={(g) => g.label} variant={variant} />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Tài sản chưa thu đủ hoặc bỏ cọc</p>
              {m.items.length ? (
                <ReportTable
                  columns={itemColumns(variant)}
                  rows={m.items}
                  rowKey={(i, idx) => `${i.assetCode ?? i.title}-${idx}`}
                  variant={variant}
                />
              ) : (
                <EmptyState compact icon={Wallet} tone="success" title="Mọi tài sản đấu thành trong kỳ đã thu đủ." />
              )}
            </div>
          </>
        ) : (
          <EmptyState compact icon={Wallet} tone="muted" title="Kỳ này chưa có tài sản đấu thành." />
        )}
      </div>
    </SectionCard>
  );
}
