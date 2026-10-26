import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import type { AuctionPlan } from "@/lib/auctionPlan/types";

/** Tầng L4: các năm khác có kế hoạch — bấm để đổi năm đang xem. */
export function PlanPastYears({
  plans,
  planYear,
  onPickYear,
}: {
  plans: readonly AuctionPlan[];
  planYear: number;
  onPickYear: (year: number) => void;
}) {
  const counts = new Map<number, number>();
  for (const plan of plans) {
    if (plan.plan_year !== planYear) counts.set(plan.plan_year, (counts.get(plan.plan_year) ?? 0) + 1);
  }
  const years = [...counts.keys()].sort((a, b) => b - a);
  if (years.length === 0) return null;

  return (
    <SectionCard title="Các năm khác" icon={History} tone="muted">
      <div className="flex flex-wrap gap-2">
        {years.map((year) => (
          <Button key={year} variant="outline" size="sm" className="gap-1.5" onClick={() => onPickYear(year)}>
            <span className="tabular-nums">{year}</span>
            <span className="text-xs text-muted-foreground">({counts.get(year)} kế hoạch)</span>
          </Button>
        ))}
      </div>
    </SectionCard>
  );
}
