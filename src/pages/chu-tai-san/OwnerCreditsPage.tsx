import { CreditsTab } from "@/components/profile/tabs/CreditsTab";
import { CreditBalanceChip } from "@/components/paywall/CreditBalanceChip";

export default function OwnerCreditsPage() {
  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Credit & Thanh toán</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mua credit để theo dõi chủ tài sản, xem báo cáo danh mục và mở khóa thông tin
          </p>
        </div>
        <CreditBalanceChip />
      </div>
      <CreditsTab defaultReturnPath="/chu-tai-san/credits" audience="owner" />
    </div>
  );
}
