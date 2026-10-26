import { useMemo, useState } from "react";
import { ListChecks, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerSearchInput } from "@/components/asset-owner-portal/ui/OwnerSearchInput";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { usePlanProgress, useSyncPlatformSteps, type PlanItemProgress } from "@/hooks/useAuctionPlanProgress";
import { normalizeAdminSearch } from "@/lib/adminUnits";
import { PLAN_ITEM_HEALTH_LABELS, PLAN_ITEM_HEALTH_ORDER } from "@/lib/auctionPlan/health";
import type { AuctionPlan, AuctionPlanItem } from "@/lib/auctionPlan/types";
import { PlanGridLegend } from "./PlanGridLegend";
import { PlanItemSheet } from "./PlanItemSheet";
import { PlanMonthGrid } from "./PlanMonthGrid";

const ANY = "all";

export interface PlanProgressTabProps {
  plan: AuctionPlan;
  items: readonly AuctionPlanItem[];
  isLoading: boolean;
  /** `ke-hoach:update` đúng chi nhánh — mốc và trường thực hiện sửa được kể cả khi đã duyệt. */
  canUpdate: boolean;
  /** Kế hoạch đang ở nháp / điều chỉnh — điều kiện để BỎ tài sản khỏi kế hoạch. */
  baselineOpen: boolean;
}

/**
 * Tab "Tiến độ" (A6): chú giải + lưới 12 tháng + ngăn chi tiết mốc công việc.
 *
 * Sức khoẻ tính ở client bằng `planItemHealth` (A5) — cùng luật với bản sao SQL
 * `auction_plan_item_health`, có test đối chiếu trên mẫu demo.
 */
export function PlanProgressTab({ plan, items, isLoading, canUpdate, baselineOpen }: PlanProgressTabProps) {
  const [term, setTerm] = useState("");
  const [health, setHealth] = useState(ANY);
  const [openId, setOpenId] = useState<string | null>(null);
  const { rows, asOf, pendingPlatform, isLoading: progressLoading } = usePlanProgress(plan, items);
  const syncM = useSyncPlatformSteps(plan);

  const shown = useMemo<PlanItemProgress[]>(() => {
    const q = normalizeAdminSearch(term);
    return rows.filter((r) => {
      if (health !== ANY && r.health !== health) return false;
      if (!q) return true;
      const hay = [r.item.title, r.item.item_code, r.item.lot_labels, r.item.location].filter(Boolean).join(" ");
      return normalizeAdminSearch(hay).includes(q);
    });
  }, [rows, term, health]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.health, (map.get(r.health) ?? 0) + 1);
    return map;
  }, [rows]);

  const openRow = rows.find((r) => r.item.id === openId) ?? null;

  if (isLoading || progressLoading) {
    return (
      <SectionCard title="Tiến độ" icon={ListChecks}>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <>
      <SectionCard
        title="Tiến độ"
        icon={ListChecks}
        count={items.length}
        actions={
          canUpdate && items.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              disabled={syncM.isPending}
              onClick={() => syncM.mutate()}
            >
              {syncM.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              )}
              Đồng bộ từ dữ liệu sàn
              {pendingPlatform > 0 ? ` (${pendingPlatform})` : ""}
            </Button>
          ) : undefined
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Chưa có tài sản nào để theo dõi."
            description="Thêm tài sản vào danh mục trước, mỗi tài sản sẽ tự có bộ mốc công việc theo loại tài sản."
          />
        ) : (
          <div className="space-y-4">
            <OwnerFilterBar>
              <OwnerSearchInput
                aria-label="Tìm tài sản trong lưới tiến độ"
                placeholder="Tìm theo tên lô, mã, vị trí…"
                value={term}
                onValueChange={setTerm}
              />
              <OwnerFilterSelect label="Sức khoẻ" value={health} onValueChange={setHealth}>
                <SelectItem value={ANY}>Tất cả</SelectItem>
                {PLAN_ITEM_HEALTH_ORDER.filter((h) => (counts.get(h) ?? 0) > 0).map((h) => (
                  <SelectItem key={h} value={h}>
                    {PLAN_ITEM_HEALTH_LABELS[h]} ({counts.get(h)})
                  </SelectItem>
                ))}
              </OwnerFilterSelect>
            </OwnerFilterBar>

            <PlanGridLegend />

            {shown.length === 0 ? (
              <EmptyState compact icon={ListChecks} tone="muted" title="Không có tài sản nào khớp bộ lọc." />
            ) : (
              <PlanMonthGrid rows={shown} planYear={plan.plan_year} onOpen={(row) => setOpenId(row.item.id)} />
            )}
          </div>
        )}
      </SectionCard>

      <PlanItemSheet
        row={openRow}
        plan={plan}
        canEdit={canUpdate}
        baselineOpen={baselineOpen}
        asOf={asOf}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
