import { Bell, BellRing, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DemandPaywallDialog } from "./DemandPaywallDialog";
import { useDemandSubscription } from "@/hooks/useDemandSubscription";

interface Props {
  /** approximate weekly new items, optional */
  weeklyNewItems?: number;
  onResetFilters?: () => void;
}

export const DemandEmptyMatch = ({ weeklyNewItems, onResetFilters }: Props) => {
  const { status } = useDemandSubscription();
  const [open, setOpen] = useState(false);
  const isActive = status === "ACTIVE";

  return (
    <>
      <div className="text-center py-12 bg-card rounded-lg border border-border">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          {isActive ? (
            <BellRing className="h-7 w-7 text-primary" />
          ) : (
            <Search className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1.5">
          Hiện chưa có tài sản phù hợp với nhu cầu của bạn
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          {isActive
            ? "Đừng lo — chúng tôi sẽ thông báo ngay khi có tài sản phù hợp được đăng."
            : "Nhưng các tài sản mới vẫn được đăng mỗi ngày."}
        </p>
        {!isActive && weeklyNewItems && weeklyNewItems > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Trung bình mỗi tuần có ~{weeklyNewItems} tài sản mới
          </p>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          {!isActive ? (
            <Button onClick={() => setOpen(true)} size="lg">
              <Bell className="h-4 w-4" />
              Theo dõi để không bỏ lỡ
            </Button>
          ) : null}
          {onResetFilters && (
            <Button variant="outline" size="lg" onClick={onResetFilters}>
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      </div>

      <DemandPaywallDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
