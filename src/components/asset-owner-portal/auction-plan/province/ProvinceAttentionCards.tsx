import { Clock, Send, Stamp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { deadlineNote, type ProvinceAttention, type ProvinceRollupRow } from "@/lib/auctionPlan/province";
import { AUCTION_PLAN_KIND_LABELS } from "@/lib/auctionPlan/types";
import { formatMoneyShort } from "@/utils/money";

/** Tối đa 5 thẻ mỗi nhóm (§A8.2) — phần còn lại nằm ở bảng tầng L3 bên dưới. */
const MAX_CARDS = 5;

interface ProvinceAttentionCardsProps {
  attention: ProvinceAttention;
  today: string;
  /** Mở kế hoạch của một đơn vị; không có kế hoạch ⇒ nút không hiện. */
  onOpenPlan: (planId: string) => void;
}

const unitMeta = (row: ProvinceRollupRow, today: string): string =>
  [
    row.cycle_kind ? AUCTION_PLAN_KIND_LABELS[row.cycle_kind] : null,
    deadlineNote(row, today),
    row.assigned_revenue ? `chỉ tiêu ${formatMoneyShort(row.assigned_revenue)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Tầng L2 của "Toàn tỉnh": ba nhóm việc của cấp tỉnh.
 *
 * Nhóm "Chưa trình" xét theo kế hoạch của ĐÚNG đợt đang mở (`cycle_plan_status`),
 * nên một xã đã có kế hoạch năm được duyệt vẫn hiện ở đây khi còn nợ kế hoạch
 * bổ sung — và biến mất ngay khi xã bấm Trình.
 */
export function ProvinceAttentionCards({ attention, today, onOpenPlan }: ProvinceAttentionCardsProps) {
  const { notSubmitted, returned, awaitingReview, late } = attention;
  const nothing =
    notSubmitted.length === 0 && returned.length === 0 && awaitingReview.length === 0 && late.length === 0;

  if (nothing) {
    return (
      <SectionCard title="Việc cần theo dõi" icon={Send}>
        <EmptyState
          icon={Send}
          compact
          title="Không có đơn vị nào đang nợ việc — tốt lắm."
          description="Mọi đơn vị trong đợt đã trình kế hoạch và không có tài sản nào trễ."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {awaitingReview.length > 0 && (
        <SectionCard title="Chờ cấp tỉnh xem xét" icon={Stamp} tone="warning" count={awaitingReview.length}>
          <div className="space-y-2">
            {awaitingReview.slice(0, MAX_CARDS).map((row) => (
              <ActionCard
                key={row.admin_unit_code}
                icon={Stamp}
                tone="warning"
                title={row.unit_name}
                meta={unitMeta(row, today)}
                actions={
                  row.plan_id ? (
                    <Button size="sm" onClick={() => onOpenPlan(row.plan_id!)}>
                      Xem để phê duyệt
                    </Button>
                  ) : null
                }
              />
            ))}
          </div>
        </SectionCard>
      )}

      {notSubmitted.length > 0 && (
        <SectionCard title="Đơn vị chưa trình kế hoạch" icon={Send} tone="warning" count={notSubmitted.length}>
          <div className="space-y-2">
            {notSubmitted.slice(0, MAX_CARDS).map((row) => (
              <ActionCard
                key={row.admin_unit_code}
                icon={Send}
                tone="warning"
                title={row.unit_name}
                meta={
                  row.cycle_plan_status
                    ? `Đang là ${row.cycle_plan_status === "draft" ? "bản nháp" : "bản bị trả lại"} · ${unitMeta(row, today)}`
                    : `Chưa lập kế hoạch cho đợt · ${unitMeta(row, today)}`
                }
                actions={
                  row.cycle_plan_id ? (
                    <Button size="sm" variant="outline" onClick={() => onOpenPlan(row.cycle_plan_id!)}>
                      Xem bản nháp
                    </Button>
                  ) : null
                }
              />
            ))}
            {notSubmitted.length > MAX_CARDS && (
              <p className="text-xs text-muted-foreground">
                và {notSubmitted.length - MAX_CARDS} đơn vị nữa — xem bảng bên dưới.
              </p>
            )}
          </div>
        </SectionCard>
      )}

      {returned.length > 0 && (
        <SectionCard title="Kế hoạch đã trả lại, chờ đơn vị sửa" icon={Undo2} tone="destructive" count={returned.length}>
          <div className="space-y-2">
            {returned.slice(0, MAX_CARDS).map((row) => (
              <ActionCard
                key={row.admin_unit_code}
                icon={Undo2}
                tone="destructive"
                title={row.unit_name}
                meta={unitMeta(row, today)}
                actions={
                  row.plan_id ? (
                    <Button size="sm" variant="outline" onClick={() => onOpenPlan(row.plan_id!)}>
                      Xem góp ý
                    </Button>
                  ) : null
                }
              />
            ))}
          </div>
        </SectionCard>
      )}

      {late.length > 0 && (
        <SectionCard title="Đơn vị có tài sản trễ kế hoạch" icon={Clock} tone="destructive" count={late.length}>
          <div className="space-y-2">
            {late.slice(0, MAX_CARDS).map((row) => (
              <ActionCard
                key={row.admin_unit_code}
                icon={Clock}
                tone="destructive"
                title={row.unit_name}
                meta={`${row.late_count} tài sản trễ${row.at_risk_count > 0 ? ` · ${row.at_risk_count} nguy cơ trễ` : ""}`}
                actions={
                  row.plan_id ? (
                    <Button size="sm" variant="outline" onClick={() => onOpenPlan(row.plan_id!)}>
                      Xem tiến độ
                    </Button>
                  ) : null
                }
              />
            ))}
            {late.length > MAX_CARDS && (
              <p className="text-xs text-muted-foreground">
                và {late.length - MAX_CARDS} đơn vị nữa — xem bảng bên dưới.
              </p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
