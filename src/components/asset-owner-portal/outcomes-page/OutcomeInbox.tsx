import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import { useResolveOutcomeConflict } from "@/hooks/useOwnerOutcomeConflict";
import type { OutcomeDueCard } from "@/hooks/useOwnerPulse";
import { REPORT_KINDS, type ReportKind } from "@/lib/ownerOutcomeReport";
import {
  INBOX_PENDING_VISIBLE,
  LEDGER_TAB_LABEL,
  conflictView,
  ledgerDay,
  ledgerMoney,
  sourceValue,
  sourceWho,
  type LedgerRow,
} from "@/lib/ownerOutcomesLedger";
import { INBOX_BTN, InboxItem } from "./InboxItem";

/** Phiên chưa khai kèm thông tin tin đăng để mô tả giống dòng sổ. */
export interface PendingInboxItem extends OutcomeDueCard {
  orgName: string | null;
  address: string | null;
  round: number | null;
}

interface OutcomeInboxProps {
  workspaceId: string;
  conflicts: LedgerRow[];
  pending: PendingInboxItem[];
  loading: boolean;
  canWriteRow: (row: LedgerRow) => boolean;
  onReport: (item: PendingInboxItem, kind: ReportKind) => void;
  onOpen: (row: LedgerRow) => void;
}

const joinDesc = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ") || null;

/** Tab "Cần xử lý": số liệu lệch trước, rồi phiên đã qua mà chưa khai kết quả (mới nhất trước). */
export function OutcomeInbox({
  workspaceId,
  conflicts,
  pending,
  loading,
  canWriteRow,
  onReport,
  onOpen,
}: OutcomeInboxProps) {
  const resolve = useResolveOutcomeConflict(workspaceId);
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="space-y-2 py-2" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (!conflicts.length && !pending.length) {
    return <p className="py-4 text-[13.5px] text-muted-foreground">Sổ đã đầy đủ — mọi phiên đã qua đều có kết quả.</p>;
  }

  const shownPending = expanded ? pending : pending.slice(0, INBOX_PENDING_VISIBLE);
  const left = pending.length - INBOX_PENDING_VISIBLE;

  return (
    <div>
      <ul aria-label={LEDGER_TAB_LABEL.todo}>
        {conflicts.map((row) => {
          const v = conflictView(row);
          const canWrite = canWriteRow(row) && !!row.listingId;
          const actions = canWrite ? v.actions : [];
          return (
            <InboxItem
              key={row.rowKey}
              tag="Lệch số liệu"
              tone="destructive"
              title={row.title}
              desc={joinDesc(row.orgName, row.address)}
              meta={[
                ...(row.date ? [{ text: `Đấu ${ledgerDay(row.date)}` }] : []),
                ...(row.round ? [{ text: `Vòng ${row.round}` }] : []),
                { text: v.gapPct !== null ? `Lệch ${v.gapPct}%` : "Khác kết quả", late: true },
              ]}
              actions={
                actions.length ? (
                  actions.map((a) => (
                    <Button
                      key={a.label}
                      variant="outline"
                      size="sm"
                      className={INBOX_BTN}
                      disabled={resolve.isPending}
                      onClick={() =>
                        resolve.mutate(
                          a.choice === "keep_mine"
                            ? { listingId: row.listingId!, choice: "keep_mine" }
                            : { listingId: row.listingId!, choice: "use_source", sourceFp: a.sourceFp },
                        )
                      }
                    >
                      {a.label}
                    </Button>
                  ))
                ) : (
                  <Button variant="outline" size="sm" className={INBOX_BTN} onClick={() => onOpen(row)}>
                    Xem nguồn
                  </Button>
                )
              }
            >
              {v.left && v.right && (
                <div className="grid grid-cols-1 gap-2.5 tabular-nums sm:grid-cols-2">
                  {[v.left, v.right].map((s, i) => (
                    <div key={i} className="rounded-[10px] bg-muted px-3 py-2.5">
                      <small className="block text-[12.5px] text-muted-foreground">{sourceWho(s)}</small>
                      <b className="text-[17px] text-foreground">{sourceValue(s)}</b>
                    </div>
                  ))}
                </div>
              )}
            </InboxItem>
          );
        })}

        {shownPending.map((item) => (
          <InboxItem
            key={item.listingId}
            tag="Chưa khai"
            tone="warning"
            title={item.title}
            desc={joinDesc(item.orgName, item.address)}
            meta={[
              { text: `Đấu ${ledgerDay(item.auctionDay)}` },
              ...(item.round ? [{ text: `Vòng ${item.round}` }] : []),
              ...(item.startingPrice ? [{ text: `Giá KĐ ${ledgerMoney(item.startingPrice)}` }] : []),
              ...(item.daysOverdue > 0 ? [{ text: `Quá ${item.daysOverdue} ngày`, late: true }] : []),
            ]}
            actions={
              item.canWrite ? (
                <>
                  <span className="mr-1 text-[12.5px] text-muted-foreground">Kết quả?</span>
                  {REPORT_KINDS.map((k) => (
                    <Button key={k} variant="outline" size="sm" className={INBOX_BTN} onClick={() => onReport(item, k)}>
                      {LEDGER_TAB_LABEL[k]}
                    </Button>
                  ))}
                </>
              ) : (
                <ReadOnlyNote />
              )
            }
          />
        ))}
      </ul>

      {left > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="block w-full border-t pt-2.5 text-left text-[13px] font-semibold text-primary hover:text-primary-hover"
        >
          {expanded ? "Thu gọn" : `Xem thêm ${left} phiên chưa khai →`}
        </button>
      )}
    </div>
  );
}
