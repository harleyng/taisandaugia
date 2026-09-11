import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CaseQaView } from "@/components/case-qa/CaseQaView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { useAuctionSession } from "@/hooks/useAuctionSessions";

/** /portal/phien-dau-gia/:id/hoi-dap — xem trước đúng nội dung người mua sẽ thấy (kể cả phiên nháp). */
export default function PhienDauGiaQaPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading } = useAuctionSession(id);

  return (
    <div className="space-y-5 px-6 py-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => navigate(`/portal/phien-dau-gia/${id}`)}>
        <ArrowLeft className="h-4 w-4" />
        Về phiên đấu giá
      </Button>

      {isLoading ? (
        <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải phiên…
        </Card>
      ) : !session ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Không tìm thấy phiên, hoặc bạn không có quyền xem phiên này.
        </Card>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-bold text-foreground">Xem trước trang hỏi đáp</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{session.code}</span> · {session.title}
            </p>
          </div>
          {session.status === "draft" && (
            <InfoBox variant="amber" className="text-sm">
              Phiên còn nháp — trang này chưa hiện trên sàn. Chỉ điều khoản ĐÃ XÁC NHẬN xuất hiện dưới đây.
            </InfoBox>
          )}
          <CaseQaView session={session} mode="preview" />
        </>
      )}
    </div>
  );
}
