import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import type { AwaitingPaymentCard } from "@/hooks/useOwnerPulse";
import { useOwnerOutcomePayments, type OutcomePaymentRow } from "@/hooks/useOwnerOutcomeReports";
import { useSettleOutcome } from "@/hooks/useOwnerCashFlow";
import { paidPercent } from "@/lib/ownerOutcomePayment";
import { PULSE_VISIBLE_LIMIT, formatDayMonth } from "@/lib/ownerPulse";
import { formatMoneyShort } from "@/utils/money";
import { ConfirmDefaultDialog, type ConfirmDefaultTarget } from "./ConfirmDefaultDialog";
import { PartialPaymentDialog, type PartialPaymentTarget } from "./PartialPaymentDialog";
import { PulseListSkeleton, ReadOnlyNote, ShowAllToggle } from "./PulseListParts";

interface AwaitingPaymentBlockProps {
  workspaceId: string;
  items: AwaitingPaymentCard[];
  loading: boolean;
}

function paymentMeta(item: AwaitingPaymentCard, row: OutcomePaymentRow | undefined): string {
  const parts: string[] = [];
  if (item.auctionDay) parts.push(`Phiên ${formatDayMonth(item.auctionDay)}`);
  if (item.source === "platform") {
    if (item.sessionCode) parts.push(item.sessionCode);
    parts.push("Sàn theo dõi thanh toán");
    return parts.join(" · ");
  }
  const paid = row?.paidAmount ?? null;
  if (item.paymentStatus === "partial" && paid) {
    const pct = paidPercent(paid, item.winningPrice);
    parts.push(`Đã thu ${formatMoneyShort(paid)}${pct !== null ? ` (${pct}%)` : ""}`);
  } else {
    parts.push("Chưa thu");
  }
  return parts.join(" · ");
}

/** L2 "Chờ thu tiền": phiên thành còn chờ tiền — thao tác nhanh ngay trên thẻ. */
export function AwaitingPaymentBlock({ workspaceId, items, loading }: AwaitingPaymentBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [partialFor, setPartialFor] = useState<PartialPaymentTarget | null>(null);
  const [defaultFor, setDefaultFor] = useState<ConfirmDefaultTarget | null>(null);

  const outcomeIds = useMemo(
    () => items.flatMap((i) => (i.outcomeId ? [i.outcomeId] : [])),
    [items],
  );
  const payments = useOwnerOutcomePayments(workspaceId, outcomeIds);
  const settle = useSettleOutcome(workspaceId);

  const shown = expanded ? items : items.slice(0, PULSE_VISIBLE_LIMIT);

  // Số còn lại do server tính (khoá dòng) — "Hoàn tác" xoá đúng khoản vừa ghi.
  const markPaid = (row: OutcomePaymentRow) => settle.mutate({ outcomeId: row.id });

  const actionsFor = (item: AwaitingPaymentCard, row: OutcomePaymentRow | undefined) => {
    if (item.source === "platform") return <ReadOnlyNote>Sàn theo dõi</ReadOnlyNote>;
    if (!item.outcomeId || !item.canWrite) return <ReadOnlyNote />;
    // Chưa đọc xong số đã thu thì chưa cho bấm (hộp "Thu một phần" cần số đó).
    const disabled = !row || settle.isPending;
    return (
      <>
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => row && markPaid(row)}>
          Đã thu đủ
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() =>
            row &&
            setPartialFor({
              outcomeId: row.id,
              title: item.title,
              winningPrice: row.winningPrice ?? item.winningPrice,
              paidAmount: row.paidAmount,
            })
          }
        >
          Thu một phần
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled}
          onClick={() => row && setDefaultFor({ outcomeId: row.id, title: item.title })}
        >
          Người trúng bỏ cọc
        </Button>
      </>
    );
  };

  return (
    <SectionCard
      title="Chờ thu tiền"
      icon={Wallet}
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
        <EmptyState compact icon={Wallet} tone="success" title="Không có khoản nào chờ thu." />
      ) : (
        <div className="space-y-2">
          {shown.map((item) => {
            const row = item.outcomeId ? payments.data?.[item.outcomeId] : undefined;
            const price = item.winningPrice ? ` — trúng ${formatMoneyShort(item.winningPrice)}` : "";
            return (
              <ActionCard
                key={item.listingId}
                icon={Wallet}
                title={`${item.title}${price}`}
                meta={paymentMeta(item, row)}
                actions={actionsFor(item, row)}
              />
            );
          })}
        </div>
      )}

      <PartialPaymentDialog workspaceId={workspaceId} target={partialFor} onClose={() => setPartialFor(null)} />
      <ConfirmDefaultDialog workspaceId={workspaceId} target={defaultFor} onClose={() => setDefaultFor(null)} />
    </SectionCard>
  );
}
