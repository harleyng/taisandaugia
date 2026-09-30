import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PlanCatalog } from "./PlanCatalog";
import { CustomPlanBanner } from "./CustomPlanBanner";
import { SubscriptionFaq } from "./SubscriptionFaq";
import { useOwnerSubPlans } from "@/hooks/useOwnerSubscriptionPlans";
import { activeTerms, sortPlans } from "@/lib/ownerSubscription/catalog";
import type { OwnerSubscriptionStatus } from "@/lib/ownerSubscription/types";

/** Kỳ chọn sẵn theo design: 6 tháng nếu có, không thì kỳ giữa danh sách. */
const defaultMonths = (months: number[]) =>
  months.includes(6) ? 6 : (months[Math.floor(months.length / 2)] ?? 12);

interface Props {
  workspaceId: string;
  sub: OwnerSubscriptionStatus | null | undefined;
  isOwner: boolean;
  showHeading?: boolean;
}

/**
 * Nạp danh mục gói + giữ kỳ đang chọn; danh mục trống ⇒ chỉ còn thanh "Cần hạn mức riêng?".
 * Hỏi đáp đi kèm danh mục (trang Các gói khác + Trạm chưa có gói), không hiện ở trang gói hiện tại.
 */
export function PlanCatalogSection({
  workspaceId,
  sub,
  isOwner,
  showHeading,
}: Props) {
  const { data: catalog, isLoading } = useOwnerSubPlans();
  const [months, setMonths] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plans = sortPlans(catalog?.plans ?? []);
  const terms = activeTerms(catalog?.terms ?? []);
  if (plans.length === 0 || terms.length === 0) {
    return (
      <div className="flex flex-col gap-[22px]">
        <CustomPlanBanner />
        <SubscriptionFaq />
      </div>
    );
  }

  const hasPlan = !!sub && sub.status !== "cancelled";
  return (
    <div className="flex flex-col gap-[22px]">
      <PlanCatalog
        workspaceId={workspaceId}
        plans={plans}
        terms={terms}
        months={months ?? defaultMonths(terms.map((t) => t.months))}
        onMonthsChange={setMonths}
        currentPlanId={hasPlan ? (sub?.plan_id ?? null) : null}
        hasPlan={hasPlan}
        pendingPlanId={sub?.pending?.plan_id ?? null}
        isOwner={sub?.is_owner ?? isOwner}
        showHeading={showHeading}
      />
      <SubscriptionFaq />
    </div>
  );
}
