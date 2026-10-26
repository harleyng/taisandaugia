import { BellPlus, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAuthState } from "@/hooks/useAuthState";
import { useFollowPublicPlanItem } from "@/hooks/usePublicPlanItems";
import type { PublicPlanItem } from "@/lib/publicPlanItems";

interface Props {
  item: PublicPlanItem;
  /** Mã ĐVHC đang xem — để làm mới đúng danh sách sau khi theo dõi. */
  scopeCode: string | null;
}

/**
 * "Theo dõi" một lô đất dự kiến đấu giá.
 *
 * KHÔNG dùng lại `src/components/demand/`: những component đó là **gói theo dõi
 * nhu cầu** trả bằng credit theo bậc (`useDemandSubscription`), còn đây là một
 * cú bấm MIỄN PHÍ vào đúng một lô — tín hiệu nhu cầu cho đơn vị lập kế hoạch.
 *
 * Khách chưa đăng nhập: mở hộp đăng nhập rồi theo dõi luôn sau khi đăng nhập
 * xong (RPC chỉ cấp cho `authenticated`).
 */
export function PlanFollowButton({ item, scopeCode }: Props) {
  const { session } = useAuthState();
  const { openAuthDialog } = useAuthDialog();
  const follow = useFollowPublicPlanItem(scopeCode);

  const toggle = (next: boolean) => {
    if (!session) {
      openAuthDialog(() => follow.mutate({ code: item.code, follow: true }));
      return;
    }
    follow.mutate({ code: item.code, follow: next });
  };

  if (item.followed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-primary/40 text-primary"
        disabled={follow.isPending}
        onClick={() => toggle(false)}
      >
        {follow.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <BellRing className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        )}
        Đang theo dõi
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" disabled={follow.isPending} onClick={() => toggle(true)}>
      {follow.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <BellPlus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      )}
      Theo dõi
    </Button>
  );
}
