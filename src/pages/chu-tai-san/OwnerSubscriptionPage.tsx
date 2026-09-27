import { useNavigate } from "react-router-dom";
import { BadgeCheck, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SubscriptionPlanCard } from "@/components/asset-owner-portal/subscription/SubscriptionPlanCard";
import { SubscriptionUsageBars } from "@/components/owner-subscription/SubscriptionUsageBars";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerSubscription } from "@/hooks/useOwnerSubscription";
import { formatSubDate } from "@/lib/ownerSubscription/status";

const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `tháng ${Number(m)}/${y}`;
};

/**
 * /chu-tai-san/goi-thue-bao — gói thuê bao của Trạm đang chọn: hiệu lực, hạn mức tháng
 * này, thanh toán / gia hạn. Tenant "Cá nhân" vẫn dùng credit (trang Credit).
 */
export default function OwnerSubscriptionPage() {
  const navigate = useNavigate();
  const { workspaceId, isLoading: wsLoading } = useOwnerWorkspace();
  const { data: sub, isLoading } = useOwnerSubscription(workspaceId);

  if (wsLoading || (workspaceId && isLoading)) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Gói thuê bao"
        subtitle="Tổ chức trả theo kỳ thay cho credit — mọi thành viên của Trạm dùng các tính năng trong gói, trong hạn mức mỗi tháng."
      />

      <OwnerNoWorkspaceState icon={BadgeCheck}>
        {!sub ? (
          <div className="py-16">
            <EmptyState
              icon={BadgeCheck}
              title="Trạm chưa có gói thuê bao"
              description="Gói thuê bao được sàn cấu hình riêng cho từng tổ chức (tính năng, hạn mức, thời hạn). Liên hệ sàn để được chào gói; trong lúc chờ, thành viên vẫn dùng credit như bình thường."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => navigate("/lien-he")}>Liên hệ sàn</Button>
                  <Button variant="outline" onClick={() => navigate("/chu-tai-san/credits")}>Xem credit</Button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="space-y-6">
            <SubscriptionPlanCard sub={sub} />

            <SectionCard title={`Hạn mức ${monthLabel(sub.period_month)}`} icon={BarChart3}>
              {sub.status === "active" ? (
                <SubscriptionUsageBars lines={sub.lines} nextResetOn={sub.next_reset_on} />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {sub.status === "scheduled"
                      ? `Gói bắt đầu từ ${formatSubDate(sub.starts_on)}. Hạn mức mỗi tháng gồm:`
                      : "Khi gói có hiệu lực, mỗi tháng Trạm được dùng:"}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                    {sub.lines.map((l) => (
                      <li key={l.variant_key}>
                        {l.name}: {l.monthly_quota === null ? "không giới hạn" : `${l.monthly_quota} lượt / tháng`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!sub.covered_for_me && sub.status === "active" && (
                <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  Bạn xem Trạm này qua liên kết trụ sở — thao tác của bạn ở đây vẫn tính credit.
                </p>
              )}
            </SectionCard>
          </div>
        )}
      </OwnerNoWorkspaceState>
    </div>
  );
}
