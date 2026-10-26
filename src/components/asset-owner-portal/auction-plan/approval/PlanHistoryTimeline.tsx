import { History, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import { usePlanHistory } from "@/hooks/useAuctionPlanApproval";
import { formatAuditDateTime } from "@/lib/ownerAudit";
import { PLAN_HISTORY_TONE, planHistoryEvents, type PlanHistoryKind } from "@/lib/auctionPlan/history";
import type { AuctionPlan } from "@/lib/auctionPlan/types";

/** Màu dấu mốc — tra bảng, KHÔNG nội suy tên màu vào chuỗi class (bẫy Tailwind). */
const DOT: Record<PlanHistoryKind, string> = {
  created: "bg-muted-foreground/40",
  submitted: "bg-primary",
  returned: "bg-destructive",
  approved: "bg-success",
  reopened: "bg-warning",
  adjusting: "bg-warning",
  closed: "bg-muted-foreground/40",
  edited: "bg-muted-foreground/40",
};

/**
 * Dòng thời gian trình — trả lại — phê duyệt, đọc từ nhật ký hoạt động
 * (`owner_audit_list` lọc theo đúng bản ghi kế hoạch).
 *
 * ⚠️ Tầng xem do SERVER quyết: người không có quyền "Xem nhật ký" chỉ thấy thao
 * tác của chính mình. Vì thế khối này nói thẳng điều đó thay vì để trang trống,
 * và các mốc quan trọng (phê duyệt, góp ý) vẫn hiện ở hai khối còn lại của tab.
 */
export function PlanHistoryTimeline({ plan }: { plan: AuctionPlan }) {
  const { data, isLoading } = usePlanHistory(plan);
  const events = planHistoryEvents(data?.rows ?? []);
  const limited = data?.level === "mine";

  return (
    <SectionCard title="Lịch sử xử lý" icon={History} count={events.length}>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          compact
          icon={ShieldCheck}
          tone="muted"
          title="Chưa có bước xử lý nào được ghi lại."
          description={
            limited
              ? "Vai trò của bạn chỉ xem được thao tác của chính mình — Trưởng đơn vị cấp quyền Xem nhật ký ở mục Vai trò."
              : undefined
          }
        />
      ) : (
        <>
          <ol className="space-y-0">
            {events.map((event, index) => (
              <li key={event.id} className="flex gap-3">
                <div className="flex w-3 shrink-0 flex-col items-center pt-1.5">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[event.kind])} aria-hidden="true" />
                  {index < events.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAuditDateTime(event.at)} · {event.actor}
                  </p>
                  {event.detail && (
                    <p className="mt-0.5 whitespace-pre-line text-xs text-foreground">{event.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {limited && (
            <p className="text-xs text-muted-foreground">
              Bạn đang xem thao tác của chính mình. Quyền “Xem nhật ký” sẽ hiện đầy đủ các bước của cả đơn vị.
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}
