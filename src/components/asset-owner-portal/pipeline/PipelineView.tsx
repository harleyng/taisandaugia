import { AlertTriangle, KanbanSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { useOwnerPipeline } from "@/hooks/useOwnerPipeline";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import type { ResolvedAssetOutcome } from "@/lib/ownerOutcomes";
import type { AssetOwnerClaim } from "@/types/asset-owner";
import { PipelineBoard } from "./PipelineBoard";

interface PipelineViewProps {
  claims: AssetOwnerClaim[];
  outcomesByListing: Record<string, ResolvedAssetOutcome | undefined>;
  loading: boolean;
  /** Tin chờ xác nhận chưa lên bảng — chuyển về dạng Bảng để xác nhận. */
  onShowTable: () => void;
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Đang tải tài sản">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-64 shrink-0 rounded-2xl" />
      ))}
    </div>
  );
}

/** Chế độ "Giai đoạn" của trang Đường ống (Phase 12) — chỉ xem. */
export function PipelineView({ claims, outcomesByListing, loading, onShowTable }: PipelineViewProps) {
  const navigate = useNavigate();
  const { canCreatePosting } = useOwnerWorkspace();
  const { board, pendingClaimCount, isLoading, postingsError, refetchPostings } = useOwnerPipeline({
    claims,
    outcomesByListing,
    loading,
  });

  if (isLoading) return <BoardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{board.total}</span> tài sản
          {" · "}
          <span className={board.overdueCount > 0 ? "font-semibold tabular-nums text-destructive" : "tabular-nums"}>
            {board.overdueCount}
          </span>{" "}
          chậm tiến độ
        </p>
        {pendingClaimCount > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>
              <span className="tabular-nums">{pendingClaimCount}</span> tài sản chờ xác nhận chưa lên bảng giai đoạn.
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onShowTable}>
              Xác nhận ở dạng Bảng
            </Button>
          </p>
        )}
      </div>

      {postingsError && (
        <EmptyState
          compact
          tone="destructive"
          icon={AlertTriangle}
          title="Không tải được hồ sơ số hoá."
          description="Bảng vẫn hiện các tin đã nhận."
          action={
            <Button variant="outline" size="sm" onClick={() => refetchPostings()}>
              Thử lại
            </Button>
          }
        />
      )}

      {board.total === 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            icon={KanbanSquare}
            title="Chưa có tài sản nào"
            description="Số hoá tài sản hoặc xác nhận tin đã nhận để theo dõi từng giai đoạn tới lúc thu tiền."
            action={
              canCreatePosting && (
                <Button onClick={() => navigate("/chu-tai-san/dang-tai-san")}>Số hoá tài sản</Button>
              )
            }
          />
        </div>
      ) : (
        <PipelineBoard board={board} />
      )}
    </div>
  );
}
