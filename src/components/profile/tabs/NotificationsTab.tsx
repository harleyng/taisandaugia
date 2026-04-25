import { Link } from "react-router-dom";
import { Bell, ChevronRight, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssetActions } from "@/hooks/useAssetActions";

export const NotificationsTab = () => {
  const { savedIds } = useAssetActions();
  const count = savedIds.size;

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
              Bạn sẽ nhận thông báo khi có cập nhật về các tài sản đang theo dõi —
              lịch đấu giá, giá khởi điểm, trạng thái phiên.
            </p>
          </div>
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
    </div>
  );
};
