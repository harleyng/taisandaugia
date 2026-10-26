import { LandPlot, MapPin, Ruler, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import { areaLabel, type PublicPlanItem } from "@/lib/publicPlanItems";
import { PlanFollowButton } from "./PlanFollowButton";

interface Props {
  item: PublicPlanItem;
  scopeCode: string | null;
}

/**
 * Một tài sản dự kiến đấu giá trên trang công khai.
 *
 * Chỉ hiện những gì RPC `get_public_plan_items` trả: tên, số lô, diện tích, loại
 * đất, QUÝ dự kiến, xã/phường. Giá chỉ hiện khi đơn vị đã bật công tắc riêng —
 * mặc định không có giá nào trong phản hồi để mà hiện.
 */
export function PlannedAuctionCard({ item, scopeCode }: Props) {
  const area = areaLabel(item.areaM2);

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <LandPlot className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">{item.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="truncate">{item.communeName}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {item.lotLabels && (
          <Badge variant="secondary" className="font-normal">
            Lô {item.lotLabels}
          </Badge>
        )}
        {item.landUseCode && (
          <Badge variant="outline" className="font-normal">
            {item.landUseCode}
          </Badge>
        )}
        {area && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Ruler className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            {area}
          </span>
        )}
      </div>

      {item.expectedStartValue !== null && (
        <p className="text-sm text-foreground">
          Giá khởi điểm dự kiến{" "}
          <span className="font-semibold text-primary">{formatMoneyShort(item.expectedStartValue)}</span>
          {item.unitStartPrice !== null && (
            <span className="text-muted-foreground"> · {formatMoneyFull(item.unitStartPrice)}/m²</span>
          )}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          {item.followCount > 0 ? `${item.followCount} người đang theo dõi` : "Chưa có ai theo dõi"}
        </span>
        <PlanFollowButton item={item} scopeCode={scopeCode} />
      </div>
    </div>
  );
}
