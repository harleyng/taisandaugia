import { Link } from "react-router-dom";
import { Bell, BellRing, ChevronRight, Heart, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useAssetActions } from "@/hooks/useAssetActions";
import { useDemandSubscription } from "@/hooks/useDemandSubscription";
import { useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { hasIntent } from "@/lib/demandMatch";
import { DemandPaywallDialog } from "@/components/demand/DemandPaywallDialog";

const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export const NotificationsTab = () => {
  const { savedIds } = useAssetActions();
  const count = savedIds.size;
  const { agentInfo } = useOnboardingTasks();
  const { status, tier, expiresAt, daysRemaining, DEMAND_TIERS } = useDemandSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const userHasIntent = hasIntent(agentInfo?.intent);
  const tierInfo = tier ? DEMAND_TIERS.find((t) => t.key === tier) : null;

  return (
    <div className="space-y-5">
      <Card className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Thông báo</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Nhận cập nhật về tài sản đang theo dõi và tài sản phù hợp với nhu cầu của bạn.
            </p>
          </div>
        </div>
      </Card>

      {/* Demand subscription card */}
      <Card className="overflow-hidden">
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {status === "ACTIVE" ? (
                <BellRing className="h-5 w-5 text-primary" />
              ) : status === "EXPIRED" ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <Bell className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground">Theo dõi nhu cầu</p>
                {status === "ACTIVE" && (
                  <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20 border-primary/20">
                    Đang hoạt động
                  </Badge>
                )}
                {status === "EXPIRED" && (
                  <Badge variant="outline" className="gap-1 text-destructive border-destructive/40">
                    Đã hết hạn
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {status === "ACTIVE"
                  ? "Tự động thông báo khi có tài sản mới phù hợp với nhu cầu đã khai báo."
                  : "Đăng ký để được thông báo ngay khi có tài sản mới phù hợp với nhu cầu của bạn."}
              </p>
            </div>
          </div>

          {!userHasIntent ? (
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">
                Bạn cần khai báo nhu cầu trong hồ sơ trước khi đăng ký theo dõi.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to="/profile?tab=info#intent">Khai báo nhu cầu</Link>
              </Button>
            </div>
          ) : status === "ACTIVE" ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gói hiện tại</span>
                <span className="font-medium text-foreground">{tierInfo?.label}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Hết hạn</span>
                <span className="font-medium text-foreground">
                  {expiresAt ? formatDate(expiresAt) : "—"} (còn {daysRemaining} ngày)
                </span>
              </div>
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setPaywallOpen(true)}>
                Gia hạn thêm
              </Button>
            </div>
          ) : (
            <Button onClick={() => setPaywallOpen(true)} className="w-full">
              <Bell className="h-4 w-4" />
              {status === "EXPIRED" ? "Gia hạn ngay" : "Đăng ký theo dõi"}
            </Button>
          )}
        </div>
      </Card>

      {count > 0 ? (
        <Card className="overflow-hidden">
          <Link
            to="/profile?tab=saved&from=notifications"
            className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="h-11 w-11 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                Đang theo dõi {count} tài sản
              </p>
              <p className="text-sm text-muted-foreground">
                Xem danh sách chi tiết
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </Link>
        </Card>
      ) : (
        <Card className="p-10 md:p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
            <Heart className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground">
            Chưa theo dõi tài sản nào
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Bấm "Nhận thông báo khi có cập nhật" trên tài sản bạn quan tâm để được
            cập nhật khi có thay đổi.
          </p>
          <Button asChild className="mt-5">
            <Link to="/listings">Khám phá tài sản</Link>
          </Button>
        </Card>
      )}

      <DemandPaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} />
    </div>
  );
};
