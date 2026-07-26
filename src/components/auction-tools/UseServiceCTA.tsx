import { Sparkles, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useRequestToolService } from "@/hooks/usePublicAuctionTools";
import type { AuctionToolProvider } from "@/types/auctionTools";

/** Nút "Sử dụng dịch vụ": bắt buộc đăng nhập → tạo lead + cơ hội qua RPC.
 *  Provider chưa gắn service → đổi sang CTA "Liên hệ tư vấn" (không tạo cơ hội được). */
export function UseServiceCTA({
  provider,
  className,
}: {
  provider: AuctionToolProvider;
  className?: string;
}) {
  const { session } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const request = useRequestToolService();

  const hasService = !!provider.service_id;

  const submit = () => {
    request.mutate(
      { providerId: provider.id },
      {
        onSuccess: (res) => {
          toast.success(
            res.deduped
              ? "Bạn đã gửi yêu cầu này rồi — đội ngũ sẽ liên hệ sớm"
              : "Đã gửi yêu cầu — đội ngũ tư vấn sẽ liên hệ với bạn",
          );
        },
        onError: () => toast.error("Gửi yêu cầu thất bại, vui lòng thử lại"),
      },
    );
  };

  const handleClick = () => {
    if (!session) {
      openAuthDialog(() => submit());
      return;
    }
    submit();
  };

  if (!hasService) {
    return (
      <Button variant="outline" className={className} onClick={() => (window.location.href = "/lien-he")}>
        <PhoneCall className="mr-2 h-4 w-4" />
        Liên hệ tư vấn
      </Button>
    );
  }

  return (
    <Button className={className} onClick={handleClick} disabled={request.isPending}>
      <Sparkles className="mr-2 h-4 w-4" />
      {request.isPending ? "Đang gửi…" : "Sử dụng dịch vụ"}
    </Button>
  );
}
