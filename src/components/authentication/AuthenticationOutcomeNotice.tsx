import { ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePostingAuthenticationOrders } from "@/hooks/useAuthenticationOrders";
import { gdVerdictLabel, isNegativeVerdict, summarizeGdOrders } from "@/lib/authentication/status";

/**
 * Thông báo RIÊNG cho người bán khi kết luận giám định tiêu cực (BR-GD-02). Đứng ngoài
 * tab của trang hồ sơ vì nó giải thích vì sao hồ sơ bị trả về nháp.
 */
export function AuthenticationOutcomeNotice({ postingId }: { postingId: string }) {
  const { data: orders = [] } = usePostingAuthenticationOrders(postingId);
  const { completed } = summarizeGdOrders(orders);
  if (!completed || !isNegativeVerdict(completed.verdict)) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex items-start gap-3 pt-5">
        <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Kết quả giám định: {gdVerdictLabel(completed.verdict)}</p>
          {completed.verdict_reason && <p className="text-sm text-foreground">{completed.verdict_reason}</p>}
          <p className="text-sm text-muted-foreground">
            {completed.posting_reverted_at ? "Hồ sơ đã được trả về nháp. " : ""}
            Tài sản không đăng được ở nhóm Cổ vật với kết quả này. Bạn có thể đặt giám định lại với đối tác khác,
            hoặc đổi sang nhóm tài sản phù hợp (ví dụ Thủ công mỹ nghệ). Thông tin này chỉ bạn và sàn nhìn thấy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
