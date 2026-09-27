import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { TARGET_PERIOD_LABEL } from "@/lib/ownerTargets";
import { formatMoneyShort } from "@/utils/money";
import {
  formatReportDay,
  type OwnerReport,
  type ReportPayload,
} from "@/lib/ownerPeriodicReport";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}

interface ReportSummaryCardProps {
  report: OwnerReport;
  /** null khi số liệu chưa dựng xong — chỉ hiện thông tin của bản ghi. */
  payload: ReportPayload | null;
  scopeLabel: string;
}

/** Cột phải của trang chi tiết: kỳ, phạm vi, người lập / chốt — các con số chính nằm ở hero. */
export function ReportSummaryCard({ report, payload, scopeLabel }: ReportSummaryCardProps) {
  const period = payload?.meta.period;
  const people = payload?.people;

  return (
    <SectionCard title="Thông tin báo cáo" icon={ClipboardList}>
      <dl className="divide-y text-sm">
        <Row label="Loại kỳ">{TARGET_PERIOD_LABEL[report.periodType]}</Row>
        {period && (
          <Row label="Thời gian">
            <span className="tabular-nums">
              {formatReportDay(period.start)} – {formatReportDay(period.end)}
            </span>
          </Row>
        )}
        <Row label="Phạm vi">{scopeLabel}</Row>
        {payload?.meta.asOf && (
          <Row label="Số liệu tính đến">
            <span className="tabular-nums">{formatReportDay(payload.meta.asOf)}</span>
          </Row>
        )}
        {payload && (
          <Row label="Chờ thu">
            <span className="tabular-nums">{formatMoneyShort(payload.money.awaiting)}</span>
          </Row>
        )}
        <Row label="Người lập">{people?.preparedBy ?? "—"}</Row>
        <Row label="Ngày lập">
          <span className="tabular-nums">{formatReportDay(report.createdAt)}</span>
        </Row>
        {report.status === "final" && (
          <>
            <Row label="Người chốt">{people?.finalizedBy ?? "—"}</Row>
            <Row label="Ngày chốt">
              <span className="tabular-nums">{formatReportDay(report.finalizedAt)}</span>
            </Row>
          </>
        )}
      </dl>
    </SectionCard>
  );
}
