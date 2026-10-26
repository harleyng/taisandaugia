import { Globe, Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { usePlanPublicState, useSetPlanPublic } from "@/hooks/useAuctionPlanPublic";
import type { AuctionPlan } from "@/lib/auctionPlan/types";

interface Props {
  plan: AuctionPlan;
}

/**
 * "Công khai danh mục dự kiến" (Phase 10 của docs/owner-auction-planning-plan.md).
 *
 * Chỉ CẤP DUYỆT (hình A: cùng Trạm · hình B: Trạm cha) hoặc Trưởng đơn vị bấm
 * được — người khác thấy thẻ ở dạng chỉ đọc. Cổng thật nằm ở RPC
 * `auction_plan_set_public`, không ở component này.
 *
 * Hai công tắc TÁCH NHAU: công khai danh mục (tên lô, số lô, diện tích, loại
 * đất, QUÝ dự kiến) và — tuỳ chọn thứ hai, mặc định TẮT — giá khởi điểm dự kiến.
 */
export function PlanPublicCard({ plan }: Props) {
  const { data: state, isLoading } = usePlanPublicState(plan.id);
  const setPublic = useSetPlanPublic(plan);
  const busy = setPublic.isPending;

  if (isLoading) {
    return (
      <SectionCard title="Công khai danh mục dự kiến" icon={Globe}>
        <Skeleton className="h-16 w-full" />
      </SectionCard>
    );
  }
  if (!state) return null;

  const approved = plan.status === "approved";
  const canToggle = state.canManage && (approved || state.optIn) && !busy;

  return (
    <SectionCard
      title="Công khai danh mục dự kiến"
      icon={Globe}
      tone={state.optIn ? "success" : "muted"}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {state.optIn
            ? `Đang công khai ${state.publicItemCount} tài sản trong mục "Sắp đấu giá theo kế hoạch" của trang tìm tài sản. Người mua xem được tên lô, số lô, diện tích, loại đất và QUÝ dự kiến — không thấy tháng, không thấy hồ sơ nội bộ.`
            : `Chưa công khai. Khi bật, ${state.publicItemCount} tài sản của bản mốc đã duyệt sẽ xuất hiện trong mục "Sắp đấu giá theo kế hoạch" để người mua quan tâm từ sớm.`}
        </p>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
          <div className="min-w-0">
            <Label htmlFor={`public-optin-${plan.id}`} className="text-sm font-medium">
              Công khai danh mục trên trang tìm tài sản
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {approved
                ? "Chỉ danh mục của bản mốc đã duyệt; tài sản đã bỏ, đã có tin đăng hoặc đã đấu giá không hiện."
                : "Chỉ bật được khi kế hoạch đã được phê duyệt."}
            </p>
          </div>
          <Switch
            id={`public-optin-${plan.id}`}
            checked={state.optIn}
            disabled={!canToggle}
            onCheckedChange={(next) => setPublic.mutate({ optIn: next, showPrices: next && state.showPrices })}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
          <div className="min-w-0">
            <Label htmlFor={`public-prices-${plan.id}`} className="text-sm font-medium">
              Kèm giá khởi điểm dự kiến
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mặc định tắt — giá dự kiến chưa phải giá khởi điểm chính thức trong thông báo đấu giá.
            </p>
          </div>
          <Switch
            id={`public-prices-${plan.id}`}
            checked={state.showPrices}
            disabled={!state.canManage || !state.optIn || busy}
            onCheckedChange={(next) => setPublic.mutate({ optIn: true, showPrices: next })}
          />
        </div>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
          {state.followTotal > 0
            ? `${state.followTotal} lượt theo dõi trên cả kế hoạch — xem chi tiết từng tài sản ở tab "Tiến độ".`
            : "Chưa có lượt theo dõi nào."}
        </p>

        {!state.canManage && (
          <p className="text-xs text-muted-foreground">
            Chỉ cấp trên hoặc Trưởng đơn vị bật / tắt được công khai.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
