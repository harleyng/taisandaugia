import { Loader2, Plus, UploadCloud, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { ASSET_POSTING_STATUS_LABELS, type AssetPostingStatus } from "@/types/asset-posting";
import { REVIEW_STATUS_BADGE_CLASS, REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import { formatPrice } from "@/utils/formatters";
import { useMyPostings } from "@/hooks/useAssetPosting";
import { useOwnerConsignmentSummary } from "@/hooks/useConsignmentContract";
import { postingBadge } from "@/lib/consignment/postingBadge";
import { useReady3dPostingIds } from "@/hooks/useAsset3dScans";
import { Model3dBadge } from "@/components/asset-3d/Model3dBadge";
import { VrTourBadge } from "@/components/vr-tour/VrTourBadge";
import { useAttachedVrPostingIds } from "@/hooks/useVrTourOrders";
import { AuthenticatedBadge } from "@/components/authentication/AuthenticatedBadge";
import { useAuthenticatedPostingIds } from "@/hooks/useAuthenticationOrders";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";

// parent slug → icon component
const PARENT_ICON = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.icon]));
// child slug → tên loại
const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

const STATUS_STYLE: Record<AssetPostingStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  matched: "bg-primary/10 text-primary",
  contracted: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

interface AssetPostingsLandingProps {
  onCreate: () => void;
  onSelect: (id: string) => void;
  /** Bản nháp mở thẳng lại wizard — màn chi tiết không có gì để xem. */
  onResumeDraft: (id: string) => void;
}

/**
 * Trang "Số hoá tài sản": hồ sơ của TENANT đang chọn (không gian hoặc Cá nhân) +
 * CTA tạo mới. Người xem / Cán bộ ngoài phạm vi chỉ xem: không tạo, nháp mở ở
 * màn chi tiết chứ không mở wizard.
 */
export function AssetPostingsLanding({ onCreate, onSelect, onResumeDraft }: AssetPostingsLandingProps) {
  const { data: postings, isLoading } = useMyPostings();
  const { workspaceId, canCreatePosting, canWritePosting } = useOwnerWorkspace();
  const { data: branches } = useWorkspaceBranchOptions(workspaceId);
  const branchLabel = new Map((branches ?? []).map((b) => [b.id, b.label]));
  const { data: summary } = useOwnerConsignmentSummary();
  const { data: with3d } = useReady3dPostingIds();
  const { data: withVr } = useAttachedVrPostingIds();
  const { data: authenticated } = useAuthenticatedPostingIds();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Tài sản đăng đấu giá</h1>
          <p className="text-sm text-muted-foreground">
            Số hóa hồ sơ tài sản và gửi yêu cầu tới tổ chức đấu giá phù hợp.
          </p>
        </div>
        {canCreatePosting && (
          <Button onClick={onCreate} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Số hoá tài sản
          </Button>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !postings || postings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center border border-dashed border-border rounded-2xl">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <UploadCloud className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Chưa có tài sản nào</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              {canCreatePosting
                ? "Bắt đầu số hóa hồ sơ tài sản đầu tiên để nhận gợi ý tổ chức đấu giá phù hợp."
                : "Không gian này chưa có hồ sơ tài sản nào."}
            </p>
          </div>
          {canCreatePosting && (
            <Button onClick={onCreate} variant="outline" className="gap-1.5 mt-1">
              <Plus className="h-4 w-4" />
              Số hoá tài sản
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {postings.map((p) => {
            const Icon = PARENT_ICON[p.parent_slug] ?? UploadCloud;
            const location = [p.district, p.province].filter(Boolean).join(", ");
            const isDraft = p.status === "draft";
            const resumable = isDraft && canWritePosting(p);
            const branch = p.branch_id ? branchLabel.get(p.branch_id) : null;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => (resumable ? onResumeDraft(p.id) : onSelect(p.id))}
                className="w-full text-left flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 hover:border-primary/40 transition-colors"
              >
                <div className="h-11 w-11 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium text-sm text-foreground">
                    <span className="truncate">{p.title}</span>
                    {with3d?.has(p.id) && <Model3dBadge className="shrink-0 px-1.5 py-0 text-[10px]" />}
                    {withVr?.has(p.id) && <VrTourBadge className="shrink-0 px-1.5 py-0 text-[10px]" />}
                    {authenticated?.has(p.id) && <AuthenticatedBadge className="shrink-0 px-1.5 py-0 text-[10px]" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {CHILD_LABEL[p.child_slug] ?? p.child_slug}
                    {location ? ` · ${location}` : ""}
                    {branch ? ` · ${branch}` : ""}
                  </p>
                </div>

                <div className="hidden sm:block text-right shrink-0">
                  {isDraft ? (
                    <p className={`text-sm font-semibold ${resumable ? "text-primary" : "text-muted-foreground"}`}>
                      {resumable ? "Tiếp tục số hoá" : "Bản nháp"}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        {p.starting_price ? formatPrice(p.starting_price, "TOTAL") : "Nhờ định giá"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Giá khởi điểm</p>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {/* Việc đang chờ / trạng thái hợp đồng — suy ra ở RPC owner_consignment_summary,
                      asset_postings.status không được ghi bởi luồng ký gửi. */}
                  {(() => {
                    const badge = postingBadge(summary?.byPosting[p.id]);
                    return badge ? (
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[p.status]}`}
                  >
                    {ASSET_POSTING_STATUS_LABELS[p.status]}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${REVIEW_STATUS_BADGE_CLASS[p.review_status]}`}
                  >
                    {REVIEW_STATUS_LABELS[p.review_status]}
                  </span>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 hidden sm:block" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
