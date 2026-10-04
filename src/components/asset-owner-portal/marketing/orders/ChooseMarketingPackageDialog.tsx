import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketingPackage } from "@/hooks/useOwnerMarketingOrders";
import type { MktOrderPackage } from "@/lib/ownerMarketing/orders";
import type { Coverage } from "@/lib/ownerSubscription/coverage";
import { MarketingPackageCard } from "./MarketingPackageCard";

interface ChooseMarketingPackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Đã lọc theo MKT_PICKABLE_PACKAGES. */
  packages: MarketingPackage[];
  isLoading: boolean;
  /** Hạn mức gói dịch vụ của Trạm cho từng gói (null = gói không dùng hạn mức). */
  coverageOf: (key: MktOrderPackage) => { coverage: Coverage | null; text: string };
  onChoose: (key: MktOrderPackage) => void;
}

/** Bước 1 của "Tạo đơn mới": chọn gói. Bước 2 (tài sản, mục tiêu, thanh toán) là CreateMarketingOrderDialog. */
export function ChooseMarketingPackageDialog({
  open,
  onOpenChange,
  packages,
  isLoading,
  coverageOf,
  onChoose,
}: ChooseMarketingPackageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto rounded-[14px] p-6 sm:max-w-5xl sm:rounded-[14px] sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Chọn gói</DialogTitle>
          <DialogDescription className="sr-only">Chọn gói truyền thông để giao việc cho sàn.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[26rem] rounded-2xl" />)
            : packages.map((p, i) => {
                const { coverage, text } = coverageOf(p.key);
                return (
                  <MarketingPackageCard
                    key={p.key}
                    pkg={p}
                    index={i + 1}
                    coverage={coverage}
                    coverageText={text}
                    onChoose={() => onChoose(p.key)}
                  />
                );
              })}
        </div>

        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          💡 Bạn chọn tài sản, mục tiêu và xem chi phí ở bước tiếp theo — vẫn đổi được gói trước khi đặt.
        </p>
      </DialogContent>
    </Dialog>
  );
}
