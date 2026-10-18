import { AlertTriangle, Ban, Check, Clock, Hash, Info, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailNote } from "@/components/portal/auction-sessions/DetailCard";
import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { DESIGN_BTN } from "@/components/portal/auction-sessions/SessionDetailHero";
import {
  depositPillOf,
  REVIEW_PILL,
  displayNameOf,
  formatFullDateTime,
  headerActionsOf,
  isRejected,
} from "@/lib/biddingContracts/contractDetail";
import type { ContractWithSession, ReviewDecision } from "@/types/bidding-contract";

interface Props {
  contract: ContractWithSession;
  lotCount: number;
  canReview: boolean;
  onDecide: (d: ReviewDecision) => void;
}

const DECISION_BTN: Record<ReviewDecision, { label: string; icon: typeof Check; variant: "outline" | "default" }> = {
  rejected: { label: "Từ chối", icon: Ban, variant: "outline" },
  needs_info: { label: "Yêu cầu bổ sung", icon: Send, variant: "outline" },
  approved: { label: "Phê duyệt", icon: Check, variant: "default" },
};

/** Thẻ đầu trang chi tiết hồ sơ (design `.hd`): mã + 2 trạng thái, tên, meta, nút duyệt. */
export function ContractHero({ contract: c, lotCount, canReview, onDecide }: Props) {
  const rv = REVIEW_PILL[c.review_status];
  const dp = depositPillOf(c);
  const { decisions, statusLine } = headerActionsOf(c);
  const shown = canReview ? decisions : [];
  const org = c.buyer_kind === "organization";

  return (
    <section className="grid gap-5 rounded-2xl bg-card px-6 py-[22px] shadow-card md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span className="rounded-[5px] bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{c.code}</span>
          <DotPill tone={rv.tone}>{rv.label}</DotPill>
          <DotPill tone={dp.tone}>Đặt trước: {dp.label}</DotPill>
        </div>
        <h1 className="mt-1 text-[23px] font-bold tracking-[-0.015em] text-foreground [text-wrap:pretty]">
          {displayNameOf(c)}
        </h1>
        <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="h-[15px] w-[15px] shrink-0" />
            Nộp {formatFullDateTime(c.paid_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-[15px] w-[15px] shrink-0" />
            {org ? `ĐDPL ${c.full_name}` : "Cá nhân"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Hash className="h-[15px] w-[15px] shrink-0" />
            {lotCount} tài sản đăng ký
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {shown.length > 0 ? (
          shown.map((d) => {
            const b = DECISION_BTN[d];
            return (
              <Button
                key={d}
                variant={b.variant}
                className={
                  d === "rejected"
                    ? `${DESIGN_BTN} text-destructive hover:bg-destructive/10 hover:text-destructive`
                    : DESIGN_BTN
                }
                onClick={() => onDecide(d)}
              >
                <b.icon className="h-4 w-4" />
                {b.label}
              </Button>
            );
          })
        ) : (
          <span className="self-center text-[13px] text-muted-foreground">
            {decisions.length > 0 ? "Vai trò của bạn không có quyền duyệt hồ sơ" : statusLine}
          </span>
        )}
      </div>
    </section>
  );
}

/** Dải ghi chú dưới đầu trang (design `ban`): yêu cầu bổ sung / đã từ chối / đã nộp lại. */
export function ContractBanner({ contract: c, deadline }: { contract: ContractWithSession; deadline: string | null }) {
  if (c.review_status === "needs_info") {
    return (
      <DetailNote icon={<AlertTriangle />}>
        Đã yêu cầu bổ sung: {c.review_note ?? "—"}.
        {deadline && ` Người đăng ký nộp lại trước ${formatFullDateTime(deadline)}.`}
      </DetailNote>
    );
  }
  if (isRejected(c)) {
    const owe = c.deposit_status === "pending_refund";
    return (
      <DetailNote tone="muted" icon={<Ban />}>
        Đã từ chối: {c.review_note ?? "—"}.{owe && " Cần hoàn trả tiền đặt trước."}
      </DetailNote>
    );
  }
  if (c.review_status === "pending" && c.resubmitted_at) {
    return (
      <DetailNote tone="muted" icon={<Info />}>
        Người đăng ký đã nộp lại lúc {formatFullDateTime(c.resubmitted_at)}
        {c.review_note && ` — yêu cầu trước đó: ${c.review_note}`}.
      </DetailNote>
    );
  }
  return null;
}
