import { AlertTriangle, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { OUTCOME_SOURCE_KIND_LABEL } from "@/lib/ownerOutcomes";
import type { OutcomeOverviewRow } from "@/lib/ownerOutcomesOverview";

const VISIBLE = 5;

interface OutcomeConflictCardsProps {
  rows: OutcomeOverviewRow[];
  onOpen: (row: OutcomeOverviewRow) => void;
  /** Bật lọc "Chỉ số liệu lệch" cho bảng bên dưới. */
  onShowAll: () => void;
}

function conflictMeta(row: OutcomeOverviewRow): string {
  const others = row.sources
    .filter((s) => s.disagrees && !s.dismissed && s.kind)
    .map((s) => OUTCOME_SOURCE_KIND_LABEL[s.kind!]);
  const winner = row.sources[0]?.kind ? OUTCOME_SOURCE_KIND_LABEL[row.sources[0].kind] : null;
  return [winner && `Đang dùng: ${winner}`, others.length && `lệch với ${[...new Set(others)].join(", ").toLowerCase()}`]
    .filter(Boolean)
    .join(" · ");
}

/** L2: tài sản có "Lệch số liệu" — mỗi thẻ mở bảng so sánh nguồn để chọn số đúng. */
export function OutcomeConflictCards({ rows, onOpen, onShowAll }: OutcomeConflictCardsProps) {
  const shown = rows.slice(0, VISIBLE);
  return (
    <SectionCard
      title="Số liệu cần đối chiếu"
      icon={AlertTriangle}
      tone={rows.length ? "warning" : "muted"}
      count={rows.length}
      actions={
        rows.length > VISIBLE ? (
          <Button variant="ghost" size="sm" onClick={onShowAll}>
            Xem tất cả
          </Button>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState compact tone="success" icon={CheckCheck} title="Các nguồn đều khớp — không có số liệu lệch." />
      ) : (
        <div className="space-y-2">
          {shown.map((row) => (
            <ActionCard
              key={row.rowKey}
              icon={AlertTriangle}
              tone="warning"
              title={row.title}
              meta={conflictMeta(row)}
              actions={
                <Button size="sm" variant="outline" onClick={() => onOpen(row)}>
                  Xem nguồn
                </Button>
              }
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
