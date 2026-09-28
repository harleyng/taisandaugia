import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PlanCard } from "./PlanCard";
import { PlanCompareTable } from "./PlanCompareTable";
import { CustomPlanBanner } from "./CustomPlanBanner";
import { planCta } from "@/lib/ownerSubscription/catalog";
import { ownerSubPlanCheckoutPath } from "@/lib/ownerSubscription/paths";
import type { OwnerSubPlan, OwnerSubTermOption } from "@/lib/ownerSubscription/types";

interface Props {
  workspaceId: string;
  plans: OwnerSubPlan[];
  terms: OwnerSubTermOption[];
  months: number;
  onMonthsChange: (months: number) => void;
  /** Gói danh mục đang dùng; null khi chưa có gói / gói riêng. */
  currentPlanId: string | null;
  hasPlan: boolean;
  pendingPlanId: string | null;
  isOwner: boolean;
  /** Tiêu đề căn giữa trong khối (tắt khi trang riêng đã có tiêu đề). */
  showHeading?: boolean;
}

/**
 * Danh mục gói (#plans trong design): chọn kỳ, 3 thẻ gói, bảng so sánh, thanh gói riêng.
 * Đổi gói có hiệu lực từ kỳ kế tiếp — server quyết định (owner_sub_plan_quote).
 */
export function PlanCatalog({
  workspaceId,
  plans,
  terms,
  months,
  onMonthsChange,
  currentPlanId,
  hasPlan,
  pendingPlanId,
  isOwner,
  showHeading = true,
}: Props) {
  const navigate = useNavigate();
  const term = terms.find((t) => t.months === months) ?? terms[0];
  const discount = term?.discount_pct ?? 0;
  const lockedHint = !isOwner
    ? "Chỉ Trưởng đơn vị đăng ký / đổi gói."
    : pendingPlanId
      ? "Trạm đã có một lần đổi gói chờ áp dụng từ kỳ sau."
      : undefined;

  return (
    <section className="pt-2">
      <div className="flex flex-col items-center gap-1 pb-1 text-center">
        {showHeading && (
          <>
            <h2 className="text-xl font-bold">{hasPlan ? "Các gói khác" : "Chọn gói cho Trạm"}</h2>
            <p className="text-[13.5px] text-muted-foreground">Đổi gói có hiệu lực từ kỳ kế tiếp. Giá chưa gồm VAT.</p>
          </>
        )}
        {lockedHint && <p className="text-[13px] font-medium text-[hsl(var(--tier-warn-strong))]">{lockedHint}</p>}
      </div>

      <div className="flex flex-col gap-[18px]">
        {terms.length > 1 && (
          <div className="mb-8 mt-7 flex justify-center">
            <div
              role="radiogroup"
              aria-label="Thời hạn"
              className="flex gap-1 rounded-full bg-card p-[5px] shadow-[inset_0_0_0_1px_hsl(var(--border)),0_4px_14px_-6px_hsl(var(--foreground)/0.18)]"
            >
              {terms.map((t) => {
                const on = t.months === months;
                return (
                  <button
                    key={t.months}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onMonthsChange(t.months)}
                    className={cn(
                      "flex h-[42px] items-center gap-2 whitespace-nowrap rounded-full px-5 text-[14.5px] font-semibold transition-colors",
                      on ? "bg-foreground text-background" : "text-foreground hover:bg-muted",
                    )}
                  >
                    {t.months} tháng
                    {t.discount_pct > 0 && (
                      <em
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11.5px] font-extrabold not-italic",
                          on ? "bg-[hsl(var(--tier-mint))] text-[hsl(var(--tier-mint-fg))]" : "bg-primary/10 text-primary",
                        )}
                      >
                        −{t.discount_pct}%
                      </em>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid items-stretch gap-4 pt-2.5 md:grid-cols-3">
          {plans.map((p, i) => {
            const cta = planCta(p, { plans, currentPlanId, hasPlan, pendingPlanId });
            const tag = p.id === currentPlanId ? "Gói hiện tại" : !hasPlan && p.is_featured ? "Phổ biến nhất" : null;
            return (
              <PlanCard
                key={p.id}
                plan={p}
                prev={plans[i - 1] ?? null}
                months={term?.months ?? months}
                discountPct={discount}
                tag={tag}
                cta={cta}
                locked={!!lockedHint}
                lockedHint={lockedHint}
                onSelect={() => navigate(ownerSubPlanCheckoutPath(workspaceId, p.id, term?.months ?? months))}
              />
            );
          })}
        </div>

        <PlanCompareTable plans={plans} currentPlanId={currentPlanId} months={term?.months ?? months} discountPct={discount} />

        <CustomPlanBanner />
      </div>
    </section>
  );
}
