import { useNavigate } from "react-router-dom";
import { AlertTriangle, BadgeCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { SubscriptionStatusBadge } from "@/components/owner-subscription/SubscriptionStatusBadge";
import {
  EXPIRY_WARNING_DAYS,
  OVERAGE_HINTS,
  daysLeft,
  formatSubDate,
  vnToday,
} from "@/lib/ownerSubscription/status";
import { ownerSubscriptionCheckoutPath } from "@/lib/ownerSubscription/paths";
import type { OwnerSubscriptionStatus } from "@/lib/ownerSubscription/types";
import { formatMoneyFull } from "@/utils/money";

/** Thẻ gói: tên, trạng thái, hiệu lực, giá mỗi kỳ, nút thanh toán / gia hạn (chỉ Trưởng đơn vị). */
export function SubscriptionPlanCard({ sub }: { sub: OwnerSubscriptionStatus }) {
  const navigate = useNavigate();
  const left = daysLeft(sub.ends_on, vnToday());
  const expiringSoon = sub.status === "active" && left !== null && left <= EXPIRY_WARNING_DAYS;

  const payLabel =
    sub.status === "offered" ? "Thanh toán để kích hoạt" : sub.status === "expired" ? "Gia hạn gói" : `Gia hạn thêm ${sub.term_months} tháng`;

  return (
    <SectionCard title={sub.plan_name} icon={BadgeCheck} actions={<SubscriptionStatusBadge status={sub.status} />}>
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Hiệu lực</dt>
          <dd className="font-medium text-foreground">
            {sub.starts_on ? `${formatSubDate(sub.starts_on)} – ${formatSubDate(sub.ends_on)}` : "Chưa kích hoạt"}
          </dd>
          {sub.status === "active" && left !== null && (
            <dd className={expiringSoon ? "text-xs text-warning" : "text-xs text-muted-foreground"}>Còn {left} ngày</dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Giá mỗi kỳ</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {sub.price_vnd > 0 ? formatMoneyFull(sub.price_vnd) : "Theo thoả thuận"} · {sub.term_months} tháng
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Mã gói</dt>
          <dd className="font-mono font-medium text-foreground">{sub.code}</dd>
        </div>
      </dl>

      {sub.status === "expired" && (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          Gói đã hết hạn ngày {formatSubDate(sub.ends_on)} — thành viên đang trả credit như chủ tài sản cá nhân.
        </p>
      )}
      {expiringSoon && (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          Gói sắp hết hạn. Gia hạn trước ngày {formatSubDate(sub.ends_on)} để không gián đoạn — kỳ mới nối tiếp ngay sau kỳ hiện tại.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {OVERAGE_HINTS[sub.overage_mode]}
      </p>

      {["offered", "active", "expired", "scheduled"].includes(sub.status) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {sub.can_pay ? (
            <Button onClick={() => navigate(ownerSubscriptionCheckoutPath(sub.id))}>
              <CreditCard className="mr-1.5 h-4 w-4" />
              {payLabel} · {formatMoneyFull(sub.price_vnd)}
            </Button>
          ) : sub.price_vnd > 0 ? (
            <p className="text-sm text-muted-foreground">Chỉ Trưởng đơn vị thanh toán / gia hạn gói.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Liên hệ sàn để kích hoạt / gia hạn gói.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
