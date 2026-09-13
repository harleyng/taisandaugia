import { ArrowUpRight, EyeOff, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Hình thức trả giá của phiên. v1 CHỈ có trả giá lên (bidding_method='ascending',
 * CHECK ở DB cũng chỉ nhận giá trị đó); hai hình thức còn lại nêu ra để người
 * dùng biết là có trong luật chứ sàn chưa làm.
 */
export function BiddingMethodNotice() {
  return (
    <Card className="space-y-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ArrowUpRight className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Trả giá lên</p>
          <p className="text-xs text-muted-foreground">
            Mỗi lượt phải cao hơn giá hiện tại ít nhất một bước giá. Người trả giá cao nhất khi hết giờ là người trúng
            đấu giá.
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        {[
          { icon: TrendingDown, label: "Đặt giá xuống" },
          { icon: EyeOff, label: "Bỏ phiếu kín" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Sắp ra mắt</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
