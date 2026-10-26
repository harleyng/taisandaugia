import { ExternalLink, FilePlus2, FileStack, Gavel, Megaphone, Unlink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { useSavePlanItemExec, type PlanItemOutcome } from "@/hooks/useAuctionPlanProgress";
import { ownerPostingFromPlanItemPath, ownerPostingPath } from "@/lib/asset-posting/paths";
import { PLAN_OUTCOME_PAYMENT_LABELS } from "@/lib/auctionPlan/health";
import { OUTCOME_KIND_LABEL, type ResolvedOutcomeKind } from "@/lib/ownerOutcomes";
import { formatMoneyFull } from "@/utils/money";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";
import type { PlanLinkKind } from "./PlanLinkDialog";

interface PlanItemLinksCardProps {
  item: AuctionPlanItem;
  plan: AuctionPlan;
  outcome: PlanItemOutcome | null;
  canEdit: boolean;
  onLink: (kind: PlanLinkKind) => void;
}

const vnDate = (iso: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};

/**
 * Liên kết dữ liệu thật của một mục kế hoạch + kết quả phiên suy ra từ đó.
 *
 * Mục KHÔNG liên kết thì không có kết quả thực tế (A5) — câu nhắc phải nói đúng
 * điều đó, chứ không hiện số 0.
 */
export function PlanItemLinksCard({ item, plan, outcome, canEdit, onLink }: PlanItemLinksCardProps) {
  const navigate = useNavigate();
  const saveM = useSavePlanItemExec(plan);
  const linked = !!item.asset_posting_id || !!item.listing_id;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Kết quả thực tế</h3>

      {outcome ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Kết quả</dt>
            <dd className="font-medium text-foreground">
              {OUTCOME_KIND_LABEL[(outcome.outcome ?? "unsold") as ResolvedOutcomeKind] ?? outcome.outcome ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ngày đấu giá</dt>
            <dd className="font-medium tabular-nums text-foreground">{vnDate(outcome.auction_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Giá trúng</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {outcome.winning_price ? formatMoneyFull(Number(outcome.winning_price)) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Thu tiền</dt>
            <dd className="font-medium text-foreground">
              {outcome.payment_status ? PLAN_OUTCOME_PAYMENT_LABELS[outcome.payment_status] ?? outcome.payment_status : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <EmptyState
          compact
          icon={Gavel}
          tone="muted"
          title={linked ? "Chưa có kết quả phiên cho mục này." : "Liên kết hồ sơ để tự cập nhật kết quả"}
          description={
            linked
              ? undefined
              : "Khi mục này gắn với hồ sơ số hoá hoặc tin đăng, sàn tự điền mốc công việc và kết quả phiên."
          }
        />
      )}

      <h3 className="text-sm font-semibold text-foreground">Liên kết dữ liệu</h3>
      <ul className="space-y-1.5">
        {item.asset_posting_id && (
          <li className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            <FileStack className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">Hồ sơ số hoá đã liên kết</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => navigate(ownerPostingPath(item.asset_posting_id!))}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Mở
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Bỏ liên kết hồ sơ số hoá"
                disabled={saveM.isPending}
                onClick={() => saveM.mutate({ itemId: item.id, values: { asset_posting_id: null } })}
              >
                <Unlink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            )}
          </li>
        )}
        {item.listing_id && (
          <li className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            <Megaphone className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">Tin đăng đã liên kết</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => navigate(`/listings/${item.listing_id}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Mở
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Bỏ liên kết tin đăng"
                disabled={saveM.isPending}
                onClick={() => saveM.mutate({ itemId: item.id, values: { listing_id: null } })}
              >
                <Unlink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </Button>
            )}
          </li>
        )}
      </ul>

      {canEdit && (
        <div className="flex flex-wrap gap-1.5">
          {!item.asset_posting_id && (
            <>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => onLink("posting")}>
                <FileStack className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                Liên kết hồ sơ số hoá
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={() => navigate(ownerPostingFromPlanItemPath(item.id))}
              >
                <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                Tạo hồ sơ số hoá từ mục này
              </Button>
            </>
          )}
          {!item.listing_id && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => onLink("listing")}>
              <Megaphone className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Liên kết tin đăng
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
