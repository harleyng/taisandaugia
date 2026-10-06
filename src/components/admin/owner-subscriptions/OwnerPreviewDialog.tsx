import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PlanCard } from "@/components/asset-owner-portal/subscription/PlanCard";
import { PlanCompareTable } from "@/components/asset-owner-portal/subscription/PlanCompareTable";
import { planCta } from "@/lib/ownerSubscription/catalog";
import { termLabel } from "@/lib/ownerSubscription/packages";
import type { OwnerSubPlan, SubTerm } from "@/lib/ownerSubscription/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageName: string;
  /** Gói đang bán của bộ, theo thứ tự hiển thị (đã gắn is_featured). */
  plans: OwnerSubPlan[];
  terms: SubTerm[];
}

/** "Xem như chủ tài sản": đúng thẻ gói của trang Gói dịch vụ, với các kỳ của bộ. */
export function OwnerPreviewDialog({ open, onOpenChange, packageName, plans, terms }: Props) {
  const [termId, setTermId] = useState<string | null>(null);
  const term = terms.find((t) => t.id === termId) ?? terms[0] ?? null;
  const months = term?.months ?? 1;
  const ctx = useMemo(() => ({ plans, currentPlanId: null as string | null, hasPlan: false, pendingPlanId: null as string | null }), [plans]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>Chủ tài sản thuộc bộ “{packageName || "chưa đặt tên"}” sẽ thấy</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          {terms.length > 0 && (
            <div role="radiogroup" aria-label="Kỳ mua" className="inline-flex flex-wrap gap-1 self-center rounded-full bg-card p-1 shadow-sm ring-1 ring-border">
              {terms.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={t.id === term?.id}
                  onClick={() => setTermId(t.id)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold",
                    t.id === term?.id ? "bg-foreground text-background" : "text-foreground hover:bg-muted",
                  )}
                >
                  {termLabel(t)}
                </button>
              ))}
            </div>
          )}
          {plans.length ? (
            <div className="grid items-stretch gap-4 pt-2.5 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
              {plans.map((p, i) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  prev={plans[i - 1] ?? null}
                  months={months}
                  discountPct={term?.discount_pct ?? 0}
                  tag={p.is_featured ? "Phổ biến nhất" : null}
                  cta={planCta(p, ctx)}
                  locked
                  lockedHint="Bản xem trước"
                  onSelect={() => undefined}
                />
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">Bộ chưa có gói nào đang bán.</div>
          )}
          {plans.length > 0 && (
            <PlanCompareTable plans={plans} currentPlanId={null} months={months} discountPct={term?.discount_pct ?? 0} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
