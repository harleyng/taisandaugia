import { CheckCircle2, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessScreenProps {
  orgName: string;
  onViewAssets: () => void;
  onPostAnother: () => void;
}

/** Màn hình xác nhận sau khi tạo hồ sơ tài sản + gửi yêu cầu dịch vụ. */
export function SuccessScreen({ orgName, onViewAssets, onPostAnother }: SuccessScreenProps) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-success" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Đã gửi yêu cầu đấu giá!</h2>
        <p className="text-sm text-muted-foreground">
          Hồ sơ tài sản của bạn đã được tạo và yêu cầu dịch vụ đã gửi tới{" "}
          <span className="font-medium text-foreground">{orgName}</span>. Tổ chức sẽ liên hệ để xác nhận và thống nhất hợp
          đồng dịch vụ đấu giá.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={onViewAssets} className="gap-2">
          Xem hồ sơ tài sản của tôi
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onPostAnother} className="gap-2">
          <Plus className="h-4 w-4" />
          Số hoá tài sản khác
        </Button>
      </div>
    </div>
  );
}
