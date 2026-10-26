import { useState } from "react";
import { ExternalLink, FileText, Loader2, Stamp } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { formatMoneyShort } from "@/utils/money";
import { planDocSignedUrl, usePlanBaselines } from "@/hooks/useAuctionPlanApproval";
import { diffBaselines } from "@/lib/auctionPlan/diff";
import { formatPlanDate } from "@/lib/auctionPlan/print";
import type { AuctionPlan, AuctionPlanBaseline } from "@/lib/auctionPlan/types";
import { PlanDiffSummary } from "./PlanDiffSummary";

/** Tệp trong bucket PRIVATE: mở bằng link tạm, không có URL công khai. */
function BaselineDoc({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    setOpening(true);
    try {
      window.open(await planDocSignedUrl(path), "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không mở được tệp.");
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={opening}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
    >
      {opening ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
      )}
      <span className="truncate">{path.split("/").pop()}</span>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function BaselineRow({ baseline, previous }: { baseline: AuctionPlanBaseline; previous: AuctionPlanBaseline | null }) {
  const totals = baseline.payload?.totals;
  const items = Array.isArray(baseline.payload?.items) ? baseline.payload.items : [];
  const diff = previous ? diffBaselines(previous.payload?.items ?? [], items) : null;

  return (
    <li className="space-y-2 rounded-xl border border-border px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-foreground">
          Bản mốc v{baseline.version}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ghi nhận {formatPlanDate(baseline.approved_at)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {totals?.item_count ?? items.length} tài sản
          {totals?.expected_total ? ` · ${formatMoneyShort(totals.expected_total)}` : ""}
        </p>
      </div>

      <p className="text-xs text-foreground">
        {baseline.approval_doc_no ? (
          <>
            Quyết định số <span className="font-medium">{baseline.approval_doc_no}</span>
            {baseline.approval_doc_date ? ` ngày ${formatPlanDate(baseline.approval_doc_date)}` : ""}
          </>
        ) : (
          <span className="text-muted-foreground">Chưa ghi số quyết định</span>
        )}
      </p>

      {baseline.approval_doc_urls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {baseline.approval_doc_urls.map((path) => (
            <BaselineDoc key={path} path={path} />
          ))}
        </div>
      )}

      {previous && (
        <PlanDiffSummary diff={diff} emptyText={`Không thay đổi so với bản mốc v${previous.version}.`} />
      )}
    </li>
  );
}

/**
 * Các bản mốc đã đóng băng (`auction_plan_baselines`): số quyết định, ngày, tệp
 * đã ký và thay đổi so với bản trước — tính ở client bằng `diffBaselines`.
 *
 * Bảng này BẤT BIẾN ở DB (trigger chặn mọi UPDATE), nên đây là bản gốc để so
 * "kế hoạch với thực tế" về sau.
 */
export function PlanBaselinesCard({ plan }: { plan: AuctionPlan }) {
  const { data: baselines = [], isLoading } = usePlanBaselines(plan.id);

  return (
    <SectionCard title="Các lần phê duyệt" icon={Stamp} count={baselines.length}>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : baselines.length === 0 ? (
        <EmptyState
          compact
          icon={Stamp}
          tone="muted"
          title="Chưa có bản mốc nào."
          description="Lần phê duyệt đầu tiên sẽ đóng băng danh mục thành bản mốc v1."
        />
      ) : (
        <ol className="space-y-2">
          {baselines.map((baseline, index) => (
            <BaselineRow
              key={baseline.id}
              baseline={baseline}
              previous={baselines[index + 1] ?? null}
            />
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
