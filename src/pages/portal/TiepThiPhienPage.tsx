import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { SessionStateBadge } from "@/components/auction-sessions/SessionStateBadge";
import { OutreachWorkspace } from "@/components/portal/outreach/OutreachWorkspace";
import { useAuctionSession } from "@/hooks/useAuctionSessions";

/** /portal/phien-dau-gia/:id/tiep-thi — gói tiếp thị + danh sách người nhận của một phiên. */
export default function TiepThiPhienPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading, error } = useAuctionSession(id);

  const shell = (content: ReactNode) => (
    <div className="space-y-5 px-6 py-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => navigate(`/portal/phien-dau-gia/${id}`)}>
        <ArrowLeft className="h-4 w-4" />
        Về phiên đấu giá
      </Button>
      {content}
    </div>
  );

  if (isLoading) {
    return shell(
      <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải phiên…
      </Card>,
    );
  }

  if (error || !session) {
    return shell(
      <Card className="space-y-3 rounded-2xl p-10 text-center">
        <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Không tìm thấy phiên, hoặc bạn không có quyền xem phiên này.</p>
      </Card>,
    );
  }

  return shell(
    <>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Tiếp thị phiên</h1>
          <SessionStateBadge session={session} />
        </div>
        <p className="text-sm text-muted-foreground">
          {session.title} · <span className="font-mono">{session.code}</span>
        </p>
      </div>

      {session.status === "cancelled" && (
        <InfoBox variant="amber" className="text-sm">
          Phiên đã huỷ — danh sách chỉ còn để tham khảo, không nên gửi thông tin tiếp thị nữa.
        </InfoBox>
      )}

      <OutreachWorkspace session={session} />
    </>,
  );
}
