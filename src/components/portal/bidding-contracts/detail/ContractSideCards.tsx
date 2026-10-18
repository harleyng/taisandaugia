import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { useContractReviewEvents } from "@/hooks/useBiddingContracts";
import { useMarkDepositRefunded } from "@/hooks/useOrgBidding";
import { useContractDepositEvents, useSetContractDeposit } from "@/hooks/useOrgBiddingContracts";
import { formatVnd } from "@/lib/advertising/slug";
import {
  DEPOSIT_PILL,
  contractHistory,
  depositMethodLabel,
  formatDayMonthYear,
  formatFullDateTime,
  isRejected,
  refundActionOf,
} from "@/lib/biddingContracts/contractDetail";
import { depositActionsFor } from "@/lib/biddingContracts/deposit";
import type { ContractWithSession } from "@/types/bidding-contract";
import { HsCard, KvList, WarnTag } from "./ui";

const SM_BTN = "h-8 rounded-lg px-[11px] text-[12.5px] font-semibold";

interface DepositProps {
  contract: ContractWithSession;
  required: number | null;
  /** Hạn nộp — hạn đóng nhận hồ sơ của phiên (null nếu phiên không khai). */
  deadline: string | null;
  canUpdate: boolean;
  onEdit: () => void;
}

/** Thẻ "Tiền đặt trước" (design `dep`). */
export function DepositCard({ contract: c, required, deadline, canUpdate, onEdit }: DepositProps) {
  const setDeposit = useSetContractDeposit();
  const markRefunded = useMarkDepositRefunded(c.session_id);
  const pill = DEPOSIT_PILL[c.deposit_status];
  const cancelled = c.auction_sessions?.status === "cancelled";
  const targets = depositActionsFor(c.deposit_status, {
    sessionCancelled: cancelled,
    sessionFinalized: !!c.auction_sessions?.finalized_at,
  }).targets;
  const canRecord = canUpdate && !isRejected(c) && targets.includes("received");
  const refund = canUpdate ? refundActionOf(c) : null;
  const busy = setDeposit.isPending || markRefunded.isPending;

  const doRefund = () => {
    if (refund === "mark") markRefunded.mutate({ contractId: c.id });
    else if (refund === "set") setDeposit.mutate({ contractId: c.id, status: "refunded" });
  };

  if (c.deposit_status === "pending") {
    return (
      <HsCard title="Tiền đặt trước" id="hs-dep">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col items-start gap-1">
            <DotPill tone={pill.tone}>{pill.label}</DotPill>
            <small className="text-[12.5px] text-muted-foreground">
              {deadline ? `Hạn nộp ${formatFullDateTime(deadline)}` : "Chưa ghi nhận"}
              {required != null && ` · ${formatVnd(required)}`}
            </small>
          </div>
          {canRecord && !cancelled && (
            <Button size="sm" className={SM_BTN} onClick={onEdit}>
              Ghi nhận tiền đặt trước
            </Button>
          )}
        </div>
      </HsCard>
    );
  }

  const received = c.deposit_amount_received ?? 0;
  const short = required != null && c.deposit_status === "received" && received < required;
  return (
    <HsCard title="Tiền đặt trước" id="hs-dep">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <DotPill tone={pill.tone}>{pill.label}</DotPill>
          {canRecord && !cancelled && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-[5px] py-1 text-[13px] font-semibold text-primary hover:text-primary/80"
            >
              <Pencil className="h-[15px] w-[15px]" />
              Sửa
            </button>
          )}
        </div>
        <KvList
          narrow
          rows={[
            [
              "Số tiền",
              <span key="a" className="tabular-nums">
                {c.deposit_amount_received != null ? formatVnd(c.deposit_amount_received) : "—"}
                {short && <WarnTag>thiếu {formatVnd((required ?? 0) - received)}</WarnTag>}
              </span>,
            ],
            ["Ngày nhận", formatDayMonthYear(c.deposit_received_at)],
            ["Hình thức", depositMethodLabel(c.deposit_method) ?? "—"],
            c.deposit_txn_ref && ["Mã giao dịch", <span key="r" className="font-mono text-[12.5px]">{c.deposit_txn_ref}</span>],
            c.deposit_note && ["Ghi chú", c.deposit_note],
            (c.deposit_status === "refunded" || c.deposit_status === "forfeited" || c.deposit_status === "applied") && [
              pill.label,
              formatDayMonthYear(c.deposit_status_changed_at),
            ],
          ]}
        />
        {refund && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className={SM_BTN} disabled={busy} onClick={doRefund}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Ghi nhận đã hoàn trả
            </Button>
          </div>
        )}
      </div>
    </HsCard>
  );
}

/** Thẻ "Lịch sử" (design `.hlog`): mua hồ sơ, duyệt, tiền đặt trước, điểm danh — mới nhất trên cùng. */
export function HistoryCard({ contract }: { contract: ContractWithSession }) {
  const review = useContractReviewEvents(contract.id);
  const deposit = useContractDepositEvents(contract.id);
  const entries = contractHistory(contract, review.data ?? [], deposit.data ?? []);

  return (
    <HsCard title="Lịch sử">
      {review.isLoading || deposit.isLoading ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải lịch sử…
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 border-l-2 pl-3.5">
          {entries.map((e, i) => (
            <li
              key={`${e.at}-${i}`}
              className={
                i === 0
                  ? "relative text-[13px] before:absolute before:-left-[19px] before:top-[5px] before:h-2 before:w-2 before:rounded-full before:bg-primary before:content-['']"
                  : "relative text-[13px] before:absolute before:-left-[19px] before:top-[5px] before:h-2 before:w-2 before:rounded-full before:bg-card before:shadow-[inset_0_0_0_2px_hsl(var(--muted-foreground))] before:content-['']"
              }
            >
              <b className="block font-medium">{e.text}</b>
              <small className="text-xs tabular-nums text-muted-foreground">
                {formatFullDateTime(e.at)} · {e.actor}
              </small>
            </li>
          ))}
        </ol>
      )}
    </HsCard>
  );
}
