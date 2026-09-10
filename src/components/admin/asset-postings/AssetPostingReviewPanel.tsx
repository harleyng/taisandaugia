import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Lock } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useReviewAssetPosting } from "@/hooks/useAdminAssetPostings";
import { ReviewStatusBadge } from "./ReviewStatusBadge";
import { RejectPostingDialog } from "./RejectPostingDialog";
import type { AdminAssetPosting } from "@/hooks/useAdminAssetPostings";

/** Panel xét duyệt sticky — theo khuôn AdminAssetOwnerKYCDetail. */
export function AssetPostingReviewPanel({ posting }: { posting: AdminAssetPosting }) {
  const canApprove = useHasAdminPermission("tai-san-tu-nguyen", "approve");
  const review = useReviewAssetPosting();
  const [rejectOpen, setRejectOpen] = useState(false);

  const processing = review.isPending;
  const reviewedAt = posting.reviewed_at
    ? format(new Date(posting.reviewed_at), "HH:mm dd/MM/yyyy", { locale: vi })
    : null;

  return (
    <div className="lg:sticky lg:top-6 space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Xét duyệt hồ sơ</h2>
        <ReviewStatusBadge status={posting.review_status} />
      </div>

      {!canApprove ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          Bạn không có quyền duyệt hồ sơ tài sản.
        </p>
      ) : posting.review_status === "pending" ? (
        <>
          <p className="text-sm text-muted-foreground">
            Kiểm tra thông tin và giấy tờ trước khi phê duyệt. Chỉ hồ sơ đã duyệt mới gửi được cho
            tổ chức đấu giá.
          </p>
          <Button
            className="w-full gap-2 bg-green-600 hover:bg-green-700"
            disabled={processing}
            onClick={() => review.mutate({ action: "approve", id: posting.id })}
          >
            <CheckCircle2 className="h-4 w-4" />
            {processing ? "Đang xử lý..." : "Phê duyệt hồ sơ"}
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 border-red-300 text-red-700 hover:bg-red-50"
            disabled={processing}
            onClick={() => setRejectOpen(true)}
          >
            <XCircle className="h-4 w-4" />
            Từ chối hồ sơ
          </Button>
        </>
      ) : posting.review_status === "approved" ? (
        <>
          <p className="flex items-start gap-2 text-sm text-green-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Hồ sơ đã được phê duyệt{reviewedAt ? ` lúc ${reviewedAt}` : ""}.
          </p>
          <Button
            variant="outline"
            className="w-full gap-2 border-red-300 text-red-700 hover:bg-red-50"
            disabled={processing}
            onClick={() => setRejectOpen(true)}
          >
            <XCircle className="h-4 w-4" />
            Thu hồi phê duyệt
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-800">Lý do từ chối</p>
            <p className="text-sm text-red-700">{posting.rejection_reason ?? "—"}</p>
            {reviewedAt && <p className="text-[11px] text-red-600">Từ chối lúc {reviewedAt}</p>}
          </div>
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={processing}
            onClick={() => review.mutate({ action: "reopen", id: posting.id })}
          >
            <RefreshCw className="h-4 w-4" />
            Mở lại để duyệt
          </Button>
        </>
      )}

      {posting.review_notes && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground">Ghi chú nội bộ</p>
          <p className="text-sm text-foreground">{posting.review_notes}</p>
        </div>
      )}

      <RejectPostingDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        processing={processing}
        onConfirm={(reason, notes) =>
          review.mutate(
            { action: "reject", id: posting.id, reason, notes },
            { onSuccess: () => setRejectOpen(false) },
          )
        }
      />
    </div>
  );
}
