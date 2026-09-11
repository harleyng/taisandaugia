import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMyCaseQuestions } from "@/hooks/useCaseQuestions";
import { formatShortDateTime } from "@/lib/caseQa/formatVn";
import { MY_QUESTION_STATE_LABELS } from "@/lib/caseQa/labels";
import { cn } from "@/lib/utils";
import type { MyQuestionState } from "@/types/case-qa";

const STATE_CLASS: Record<MyQuestionState, string> = {
  answered: "border-primary/30 bg-primary/10 text-primary",
  pending_review: "border-border bg-muted text-muted-foreground",
  escalated: "border-amber-200 bg-amber-50 text-amber-800",
  outdated: "border-border bg-muted text-muted-foreground",
};

/** Câu hỏi của chính người mua cho phiên này — chỉ câu trả lời ĐÃ GỬI mới hiện. */
export function MyQuestionsList({ sessionId }: { sessionId: string }) {
  const { userId } = useAuth();
  const { data = [], isLoading } = useMyCaseQuestions(sessionId);
  if (!userId) return null;

  return (
    <Card className="space-y-3 rounded-2xl p-4">
      <h3 className="font-semibold text-foreground">Câu hỏi của tôi</h3>
      {isLoading ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bạn chưa gửi câu hỏi nào cho phiên này.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((q) => (
            <li key={q.message_id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{q.question}</p>
                <Badge variant="outline" className={cn("shrink-0 text-[11px]", STATE_CLASS[q.state])}>
                  {MY_QUESTION_STATE_LABELS[q.state]}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Gửi lúc {formatShortDateTime(q.asked_at)}</p>
              {q.answer_body ? (
                <div className="space-y-1">
                  <p className="whitespace-pre-line rounded-lg bg-muted p-3 text-sm text-foreground">{q.answer_body}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {q.answered_by === "staff" ? "Chuyên viên trả lời" : "Trích nguyên văn tài liệu phiên"} ·{" "}
                    {formatShortDateTime(q.answered_at)}
                  </p>
                </div>
              ) : q.state === "outdated" ? (
                <p className="text-xs text-muted-foreground">
                  Tài liệu phiên đã được cập nhật sau câu trả lời trước. Hãy xem lại mục câu hỏi thường gặp hoặc gửi lại
                  câu hỏi.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
