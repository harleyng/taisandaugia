import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminProfileName, useUpdateBrokerExpectedDate } from "@/hooks/useAdminConsignment";
import type { AssetBrokerRequest } from "@/types/asset-posting";

/**
 * Chuyên viên phụ trách + ngày dự kiến có báo giá của yêu cầu "nhờ sàn" — hai dòng
 * chủ tài sản thấy ở thẻ "Sàn đang chọn tổ chức giúp bạn".
 */
export function BrokerPlanFields({ broker }: { broker: AssetBrokerRequest }) {
  const { data: assignee } = useAdminProfileName(broker.assigned_admin_id);
  const update = useUpdateBrokerExpectedDate();

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <div className="text-xs">
        <p className="text-muted-foreground">Chuyên viên phụ trách</p>
        <p className="font-medium text-foreground">
          {broker.assigned_admin_id ? (assignee ?? "—") : "Gán khi gửi hồ sơ cho tổ chức"}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`expected-${broker.id}`} className="text-xs font-normal text-muted-foreground">
          Báo giá dự kiến
        </Label>
        <Input
          id={`expected-${broker.id}`}
          type="date"
          className="h-8 w-40 text-xs"
          value={broker.expected_quote_by ?? ""}
          disabled={update.isPending}
          onChange={(e) =>
            e.target.value &&
            update.mutate({ brokerRequestId: broker.id, postingId: broker.asset_posting_id, date: e.target.value })
          }
        />
      </div>
    </div>
  );
}
