import { CustomerAdCampaignsCard } from "./CustomerAdCampaignsCard";
import { CustomerEmailCampaignsCard } from "./CustomerEmailCampaignsCard";

interface Props {
  customerId: string;
  userId: string | null;
  onLinkAccount: () => void;
}

/** Tab "Chiến dịch" = hai kênh chạy cho khách hàng: banner quảng cáo (gắn theo
 *  customer_id) và email marketing (gắn theo tài khoản sàn). */
export function CustomerCampaignsTab({ customerId, userId, onLinkAccount }: Props) {
  return (
    <div className="space-y-4">
      <CustomerAdCampaignsCard customerId={customerId} />
      <CustomerEmailCampaignsCard userId={userId} onLinkAccount={onLinkAccount} />
    </div>
  );
}
