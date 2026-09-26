import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReadOnlyNote, ShowAllToggle } from "@/components/asset-owner-portal/pulse/PulseListParts";
import type { Receivable } from "@/lib/ownerCashFlow";
import { PULSE_VISIBLE_LIMIT, formatDayFull } from "@/lib/ownerPulse";
import { formatMoneyShort } from "@/utils/money";
import type { CanWriteRow, CashDialogState } from "./cashFlowDialogState";

interface OverdueReceivablesBlockProps {
  items: Receivable[];
  /** Tên đơn vị — chỉ truyền khi đang xem toàn hệ thống. */
  unitNames: ReadonlyMap<string, string> | null;
  canWrite: CanWriteRow;
  onAction: (d: CashDialogState) => void;
}

/** L2 "Quá hạn thu tiền": khoản đã quá hạn, thao tác ngay trên thẻ. */
export function OverdueReceivablesBlock({ items, unitNames, canWrite, onAction }: OverdueReceivablesBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, PULSE_VISIBLE_LIMIT);

  return (
    <SectionCard
      title="Quá hạn thu tiền"
      icon={Clock}
      tone={items.length ? "warning" : "success"}
      count={items.length}
      actions={
        items.length > PULSE_VISIBLE_LIMIT ? (
          <ShowAllToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState compact icon={Clock} tone="success" title="Không có khoản nào quá hạn." />
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const meta = [
              `Quá hạn ${r.daysOverdue} ngày`,
              r.dueOn ? `hạn ${formatDayFull(r.dueOn)}${r.dueIsDefault ? " (mặc định 30 ngày sau phiên)" : ""}` : null,
              unitNames?.get(r.row.unitId) ?? r.row.branchName,
            ].filter(Boolean);
            const writable = r.row.ownOutcomeId !== null && canWrite(r.row.unitId, r.row.branchId);
            return (
              <ActionCard
                key={`${r.row.unitId}|${r.row.rowKey}`}
                icon={Clock}
                tone="warning"
                title={`${r.row.title} — còn ${formatMoneyShort(r.remaining)}`}
                meta={meta.join(" · ")}
                actions={
                  writable ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAction({ kind: "record", outcomeId: r.row.ownOutcomeId, presetKind: "payment" })}
                      >
                        Ghi thu
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onAction({ kind: "due", row: r.row })}>
                        Đặt hạn
                      </Button>
                    </>
                  ) : (
                    <ReadOnlyNote />
                  )
                }
              />
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
