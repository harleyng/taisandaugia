import { KanbanSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { formatMoneyFull } from "@/utils/money";
import { OUTCOME_KIND_LABEL } from "@/lib/ownerOutcomes";
import type { ResolvedOutcomeKind } from "@/lib/ownerOutcomes";
import { PLAN_OUTCOME_PAYMENT_LABELS } from "@/lib/auctionPlan/health";
import { monthLabel } from "@/lib/auctionPlan/totals";
import { planDayLabel, type PlanPeriodItem, type PlanPeriodMembership } from "@/lib/auctionPlan/period";

const MEMBERSHIP: Record<PlanPeriodMembership, string> = {
  planned: "Theo kế hoạch",
  actual: "Có kết quả trong kỳ",
  both: "Theo kế hoạch · đã đấu",
};

/** Bảng tài sản của kỳ (tầng L4) — kế hoạch, thực tế và chênh lệch trên một dòng. */
export function PlanPeriodItemsTable({ items, periodLabel }: { items: readonly PlanPeriodItem[]; periodLabel: string }) {
  return (
    <SectionCard title={`Tài sản của ${periodLabel}`} icon={KanbanSquare} count={items.length}>
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={KanbanSquare}
          tone="muted"
          title={`Không có tài sản nào thuộc ${periodLabel}.`}
          description="Chọn kỳ khác, hoặc bổ sung tháng dự kiến cho tài sản trong tab Danh mục tài sản."
        />
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Tài sản
                </th>
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Tháng kế hoạch
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Giá khởi điểm dự kiến
                </th>
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Kết quả
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Giá trúng
                </th>
                <th scope="col" className="py-2 text-left font-medium">
                  Thu tiền
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ row, membership }) => {
                const o = row.outcome;
                return (
                  <tr key={row.itemId} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-foreground">{row.title || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.itemCode ? `${row.itemCode} · ` : ""}
                        {MEMBERSHIP[membership]}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">{monthLabel(row.baselineMonth)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                      {row.baselineExpected > 0 ? formatMoneyFull(row.baselineExpected) : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {o?.outcome ? (
                        <>
                          <Badge variant="outline">
                            {OUTCOME_KIND_LABEL[o.outcome as ResolvedOutcomeKind] ?? o.outcome}
                          </Badge>
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{planDayLabel(o.auction_date)}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Chưa có kết quả</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                      {o?.winning_price ? formatMoneyFull(Number(o.winning_price)) : "—"}
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {o?.payment_status
                        ? PLAN_OUTCOME_PAYMENT_LABELS[o.payment_status] ?? o.payment_status
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
