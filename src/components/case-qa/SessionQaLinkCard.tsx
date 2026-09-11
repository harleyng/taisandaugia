import { useNavigate } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Lối vào trang hỏi đáp từ trang chi tiết phiên. */
export function SessionQaLinkCard({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  return (
    <Card className="space-y-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <MessagesSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Hỏi đáp về phiên</p>
          <p className="text-xs text-muted-foreground">
            Tiền đặt trước, hạn đăng ký, lịch xem tài sản, bước giá… trả lời kèm trích dẫn tài liệu phiên.
          </p>
        </div>
      </div>
      <Button className="w-full" onClick={() => navigate(`/sessions/${sessionId}/hoi-dap`)}>
        Xem hỏi đáp
      </Button>
    </Card>
  );
}
