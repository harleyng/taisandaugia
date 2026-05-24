import { CreditsTab } from '@/components/profile/tabs/CreditsTab'
import { CreditBalanceChip } from '@/components/paywall/CreditBalanceChip'

export default function PortalCreditsPage() {
  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Credit & Thanh toán</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mua credit để mở khóa thông tin tài sản, tổ chức và báo cáo thị trường
          </p>
        </div>
        <CreditBalanceChip />
      </div>
      <CreditsTab defaultReturnPath="/portal/credits" />
    </div>
  )
}
