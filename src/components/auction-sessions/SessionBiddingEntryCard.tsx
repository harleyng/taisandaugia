import { useNavigate } from "react-router-dom";
import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { sessionPhaseOf } from "@/lib/auctionSessions/phase";
import type { PublicSessionDetail } from "@/types/auction-session";

/** Lối vào phòng đấu giá từ trang chi tiết phiên. Tự ẩn khi phiên không trực tuyến. */

const ONLINE_FORMATS = new Set(["truc_tuyen", "ca_hai"]);

export function SessionBiddingEntryCard({ session }: { session: PublicSessionDetail }) {
  const navigate = useNavigate();

  if (session.status !== "published" || !ONLINE_FORMATS.has(session.auction_format)) return null;

  const phase = sessionPhaseOf(session);
  const roomPath = `/sessions/${session.id}/dau-gia`;
  const started = phase === "ongoing" || phase === "ended";
  const finalized = !!session.finalized_at;

  return (
    <Card className="space-y-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Gavel className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Đấu giá trực tuyến</p>
          <p className="text-xs text-muted-foreground">
            {finalized
              ? "Phiên đã chốt kết quả. Người đã tham gia vẫn xem lại được diễn biến từng lô."
              : started
                ? "Trả giá trực tiếp trên sàn. Cần hồ sơ đã thanh toán, tiền đặt trước đã nộp và số báo danh."
                : `Phòng đấu giá mở lúc ${formatDateTime(session.starts_at)}.`}
          </p>
        </div>
      </div>
      <Button
        className="w-full"
        variant={phase === "ended" || finalized ? "outline" : "default"}
        disabled={!started}
        onClick={() => navigate(roomPath)}
      >
        {finalized
          ? "Xem kết quả đấu giá"
          : phase === "ended"
            ? "Xem diễn biến đấu giá"
            : started
              ? "Vào phòng đấu giá"
              : "Chưa đến giờ"}
      </Button>
    </Card>
  );
}
