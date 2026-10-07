import { Loader2 } from "lucide-react";
import { useContractReviewEvents } from "@/hooks/useBiddingContracts";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { cn } from "@/lib/utils";
import { REVIEW_EVENT_LABELS, type ReviewEventKind } from "@/types/bidding-contract";

const DOT: Record<ReviewEventKind, string> = {
  submitted: "bg-muted-foreground",
  resubmitted: "bg-muted-foreground",
  needs_info: "bg-warning",
  approved: "bg-success",
  rejected: "bg-destructive",
};

/** Nhật ký duyệt (chỉ ghi thêm) của một hồ sơ — người mua và tổ chức đều đọc được. */
export function ContractReviewHistory({ contractId }: { contractId: string }) {
  const { data: events = [], isLoading, isError } = useContractReviewEvents(contractId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải lịch sử duyệt…
      </div>
    );
  }
  if (isError) return <p className="text-sm text-muted-foreground">Không tải được lịch sử duyệt.</p>;
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Chưa có lịch sử duyệt.</p>;

  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[e.kind])} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {REVIEW_EVENT_LABELS[e.kind]}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDateTime(e.at)}</span>
            </p>
            {e.note && <p className="whitespace-pre-line text-sm text-muted-foreground">{e.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
