import { CalendarRange, Clock } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { PLAN_ITEM_HEALTH_LABELS } from "@/lib/auctionPlan/health";
import { AUCTION_PLAN_KIND_LABELS } from "@/lib/auctionPlan/types";
import type { ReportPayload } from "@/lib/ownerPeriodicReport";
import {
  planAttentionReason,
  planDayLabel,
  planExecutionHeadline,
  planExecutionUnitLabel,
  planMonthLabel,
  type PlanExecutionAttentionItem,
  type PlanExecutionMove,
  type PlanExecutionPlan,
} from "@/lib/ownerReportPlanExecution";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import { ReportTable, type ReportColumn, type ReportVariant } from "./ReportTable";

const PLAN_COLUMNS: ReportColumn<PlanExecutionPlan>[] = [
  {
    label: "Đơn vị / kế hoạch",
    render: (p) => (
      <span className="block min-w-0">
        <span className="block font-medium text-foreground">{planExecutionUnitLabel(p)}</span>
        <span className="block text-xs text-muted-foreground">
          {p.kind ? AUCTION_PLAN_KIND_LABELS[p.kind] : "Kế hoạch"}
          {p.planYear ? ` ${p.planYear}` : ""}
          {p.approvalDocNo ? ` · ${p.approvalDocNo}` : ""}
          {p.approvalDocDate ? ` ngày ${planDayLabel(p.approvalDocDate)}` : ""}
        </span>
      </span>
    ),
    className: "w-[30%]",
  },
  { label: "Kế hoạch (tài sản)", render: (p) => p.metrics.plannedCount, numeric: true },
  { label: "Đưa ra đấu giá", render: (p) => p.metrics.offeredCount, numeric: true },
  { label: "Đấu thành", render: (p) => p.metrics.soldCount, numeric: true },
  { label: "Tỷ lệ hoàn thành", render: (p) => (p.metrics.donePct === null ? "—" : `${p.metrics.donePct}%`), numeric: true },
  { label: "Giá trị khởi điểm KH", render: (p) => formatMoneyFull(p.metrics.plannedStartValue), numeric: true },
  { label: "Tổng giá trúng", render: (p) => formatMoneyFull(p.metrics.winningTotal), numeric: true },
  { label: "Đã thu", render: (p) => formatMoneyFull(p.metrics.collected), numeric: true },
  {
    label: "Trễ / nguy cơ",
    render: (p) => `${p.lateCount} / ${p.atRiskCount}`,
    numeric: true,
  },
];

interface AttentionRow extends PlanExecutionAttentionItem {
  unit: string;
}

const ATTENTION_COLUMNS: ReportColumn<AttentionRow>[] = [
  {
    label: "Tài sản",
    render: (i) => (
      <span className="block min-w-0">
        <span className="block font-medium text-foreground">{i.title ?? "Tài sản chưa đặt tên"}</span>
        <span className="block text-xs text-muted-foreground">
          {i.unit}
          {i.itemCode ? ` · ${i.itemCode}` : ""}
        </span>
      </span>
    ),
    className: "w-[26%]",
  },
  { label: "Tình trạng", render: (i) => (i.health ? PLAN_ITEM_HEALTH_LABELS[i.health] : "—") },
  { label: "Tháng bản mốc", render: (i) => planMonthLabel(i.baselineMonth), numeric: true },
  { label: "Dự kiến mới", render: (i) => planMonthLabel(i.forecastMonth), numeric: true },
  { label: "Mốc đã xong", render: (i) => `${i.stepsDone}/${i.stepsTotal}`, numeric: true },
  { label: "Lý do", render: (i) => planAttentionReason(i), className: "w-[28%]" },
];

interface MoveRow extends PlanExecutionMove {
  unit: string;
}

const MOVE_COLUMNS: ReportColumn<MoveRow>[] = [
  {
    label: "Tài sản",
    render: (i) => (
      <span className="block min-w-0">
        <span className="block font-medium text-foreground">{i.title ?? "Tài sản chưa đặt tên"}</span>
        <span className="block text-xs text-muted-foreground">
          {i.unit}
          {i.itemCode ? ` · ${i.itemCode}` : ""}
        </span>
      </span>
    ),
    className: "w-[32%]",
  },
  { label: "Bản mốc", render: (i) => planMonthLabel(i.baselineMonth), numeric: true },
  { label: "Dự kiến mới", render: (i) => planMonthLabel(i.forecastMonth), numeric: true },
  { label: "Tình trạng", render: (i) => (i.health ? PLAN_ITEM_HEALTH_LABELS[i.health] : "—") },
  { label: "Lý do dời", render: (i) => i.reason ?? "Chưa khai lý do", className: "w-[34%]" },
];

/**
 * "Thực hiện kế hoạch đấu giá" — phần của payload v2 (Phase 8 của
 * docs/owner-auction-planning-plan.md). Mọi số lấy nguyên từ owner_report_plan_execution,
 * bên trong là auction_plan_period_metrics — ĐÚNG hàm mà tab "Theo kỳ" của kế hoạch đọc.
 *
 * Phần này KHÔNG mang số thứ tự: các phần 1–7 của §A5 đã đóng băng trong những báo cáo
 * đã chốt ở payload v1, đánh số lại sẽ làm bản v1 hiển thị khác lúc chốt.
 *
 * payload v1 (không có khoá `plan_execution`) ⇒ trả null, phần này không hiện.
 * Có phần nhưng phạm vi chưa có kế hoạch nào được duyệt ⇒ một dòng EmptyState, không lỗi.
 */
export function ReportPlanExecutionSection({ payload, variant }: { payload: ReportPayload; variant: ReportVariant }) {
  const pe = payload.planExecution;
  if (!pe) return null;

  const t = pe.totals;
  const attention: AttentionRow[] = pe.plans.flatMap((p) =>
    p.attention.map((i) => ({ ...i, unit: planExecutionUnitLabel(p) })),
  );
  const moves: MoveRow[] = pe.plans.flatMap((p) =>
    p.forecastMoves.map((i) => ({ ...i, unit: planExecutionUnitLabel(p) })),
  );

  return (
    <SectionCard
      title="Thực hiện kế hoạch đấu giá"
      icon={CalendarRange}
      tone={t.lateCount ? "warning" : "primary"}
      count={t.plans}
    >
      {pe.plans.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarRange}
          tone="muted"
          title="Phạm vi này chưa có kế hoạch đấu giá nào được duyệt cho năm của kỳ báo cáo."
        />
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-foreground">
            {planExecutionHeadline(pe)}{" "}
            <span className="text-muted-foreground">
              · {t.plans} kế hoạch đã duyệt · {t.itemCount} tài sản trong danh mục · tình trạng tính đến{" "}
              {planDayLabel(pe.asOf)}
            </span>
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4 print:[&_p]:whitespace-normal">
            <StatTile
              label="Tài sản theo kế hoạch"
              value={String(t.plannedCount)}
              context={`Đã đưa ra đấu giá ${t.offeredCount}`}
              icon={CalendarRange}
            />
            <StatTile
              label="Tỷ lệ hoàn thành"
              value={t.donePct === null ? "—" : String(t.donePct)}
              unit={t.donePct === null ? undefined : "%"}
              context={`Đấu thành ${t.soldCount} tài sản`}
            />
            <StatTile
              label="Tổng giá trúng"
              value={formatMoneyShort(t.winningTotal)}
              context={`Giá trị khởi điểm theo kế hoạch ${formatMoneyShort(t.plannedStartValue)}`}
            />
            <StatTile
              label="Đã thu"
              value={formatMoneyShort(t.collected)}
              context={t.awaiting > 0 ? `Còn chờ thu ${formatMoneyShort(t.awaiting)}` : "Đã thu đủ phần đấu thành"}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Từng kế hoạch trong kỳ</h3>
            <ReportTable
              columns={PLAN_COLUMNS}
              rows={pe.plans}
              rowKey={(p, idx) => `${p.adminUnitCode ?? p.title ?? "plan"}-${idx}`}
              variant={variant}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Tài sản trễ kế hoạch và nguy cơ trễ
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t.lateCount} trễ · {t.atRiskCount} nguy cơ · {t.failedRetryCount} chờ đấu lại
              </span>
            </h3>
            {attention.length ? (
              <ReportTable
                columns={ATTENTION_COLUMNS}
                rows={attention}
                rowKey={(i, idx) => `${i.itemCode ?? i.title ?? "item"}-${idx}`}
                variant={variant}
              />
            ) : (
              <EmptyState compact icon={Clock} tone="success" title="Không có tài sản nào trễ kế hoạch — tốt lắm." />
            )}
          </div>

          {moves.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Tài sản đã dời tháng dự kiến
                <span className="ml-2 text-xs font-normal text-muted-foreground">{t.movedCount} tài sản</span>
              </h3>
              <ReportTable
                columns={MOVE_COLUMNS}
                rows={moves}
                rowKey={(i, idx) => `${i.itemCode ?? i.title ?? "move"}-${idx}`}
                variant={variant}
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Cột kế hoạch luôn là BẢN MỐC của lần phê duyệt mới nhất; thực tế lấy từ kết quả phiên của đúng kỳ — cùng
            phép tính với tab "Theo kỳ" của kế hoạch đấu giá.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
