import { useState } from "react";
import { CheckCheck, Clock, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReportOutcomeDialog } from "@/components/asset-owner-portal/outcomes/ReportOutcomeDialog";
import type { OutcomeDueCard } from "@/hooks/useOwnerPulse";
import { OUTCOME_KIND_LABEL } from "@/lib/ownerOutcomes";
import {
  REPORT_KINDS,
  REPORT_KIND_META,
  type ReportKind,
  type ReportOutcomeTarget,
} from "@/lib/ownerOutcomeReport";
import {
  OUTCOME_OVERDUE_WARN_DAYS,
  PULSE_VISIBLE_LIMIT,
  formatDayFull,
  formatDayMonth,
} from "@/lib/ownerPulse";
import { formatMoneyShort } from "@/utils/money";
import { PulseListSkeleton, ReadOnlyNote, ShowAllToggle } from "./PulseListParts";

interface OutcomeDueBlockProps {
  workspaceId: string;
  items: OutcomeDueCard[];
  loading: boolean;
}

function dueMeta(item: OutcomeDueCard): string {
  const parts: string[] = [];
  if (item.startingPrice) parts.push(`Giá KĐ ${formatMoneyShort(item.startingPrice)}`);
  if (item.previous?.outcome) {
    const when = item.previous.date ? ` ${formatDayFull(item.previous.date)}` : "";
    parts.push(`Lượt trước: ${OUTCOME_KIND_LABEL[item.previous.outcome]}${when}`);
  }
  if (item.daysOverdue > OUTCOME_OVERDUE_WARN_DAYS) parts.push(`quá ${item.daysOverdue} ngày`);
  return parts.join(" · ");
}

/** L2 "Chờ khai kết quả": phiên đã qua mà chưa biết kết quả — bấm lựa chọn là mở form đã chọn sẵn. */
export function OutcomeDueBlock({ workspaceId, items, loading }: OutcomeDueBlockProps) {
  const [expanded, setExpanded] = useState(false);
  // Giữ target khi đóng để dialog không trống chữ lúc đang tắt dần.
  const [target, setTarget] = useState<ReportOutcomeTarget | null>(null);
  const [kind, setKind] = useState<ReportKind>("sold");
  const [open, setOpen] = useState(false);

  const shown = expanded ? items : items.slice(0, PULSE_VISIBLE_LIMIT);

  const openDialog = (item: OutcomeDueCard, k: ReportKind) => {
    setTarget({
      listingId: item.listingId,
      title: item.title,
      startingPrice: item.startingPrice,
      auctionTime: item.auctionTime,
    });
    setKind(k);
    setOpen(true);
  };

  return (
    <SectionCard
      title="Chờ khai kết quả"
      icon={Gavel}
      count={loading ? undefined : items.length}
      actions={
        items.length > PULSE_VISIBLE_LIMIT ? (
          <ShowAllToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        ) : undefined
      }
    >
      {loading ? (
        <PulseListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState compact icon={CheckCheck} tone="success" title="Đã khai đủ kết quả các phiên — tốt lắm." />
      ) : (
        <div className="space-y-2">
          {shown.map((item) => {
            const late = item.daysOverdue > OUTCOME_OVERDUE_WARN_DAYS;
            return (
              <ActionCard
                key={item.listingId}
                icon={late ? Clock : Gavel}
                tone={late ? "warning" : "primary"}
                title={`Phiên ${formatDayMonth(item.auctionDay)} · ${item.title} — kết quả thế nào?`}
                meta={dueMeta(item) || undefined}
                actions={
                  item.canWrite ? (
                    REPORT_KINDS.map((k) => (
                      <Button key={k} variant="outline" size="sm" onClick={() => openDialog(item, k)}>
                        {REPORT_KIND_META[k].label}
                      </Button>
                    ))
                  ) : (
                    <ReadOnlyNote />
                  )
                }
              />
            );
          })}
        </div>
      )}

      <ReportOutcomeDialog
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        target={target}
        defaultKind={kind}
      />
    </SectionCard>
  );
}
