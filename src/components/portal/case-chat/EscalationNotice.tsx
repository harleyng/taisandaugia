import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/shared/InfoBox";
import { useRetryCaseAnswer } from "@/hooks/useOrgChat";
import { ESCALATION_REASON_LABELS } from "@/lib/caseQa/labels";
import { escalationOf, type ChatThreadMessage } from "@/types/case-chat";

interface Props {
  message: ChatThreadMessage;
  canRetry: boolean;
}

/** Câu hỏi chưa có câu trả lời (chuyển tiếp, hoặc nháp đã bỏ). "Chạy lại AI" luôn ra NHÁP. */
export function EscalationNotice({ message, canRetry }: Props) {
  const retry = useRetryCaseAnswer();
  const escalation = escalationOf(message);
  const code = message.auction_sessions?.code;

  return (
    <InfoBox variant="amber" className="ml-auto max-w-[92%] space-y-2 text-sm">
      <p className="font-semibold">Cần chuyên viên trả lời</p>
      <p className="text-xs">
        {escalation
          ? `Lý do: ${ESCALATION_REASON_LABELS[escalation.reason]}. Câu hỏi đã vào sổ chuyển tiếp để bổ sung tài liệu phiên.`
          : "Bản nháp AI đã bị bỏ — hãy tự trả lời hoặc chạy lại AI."}
      </p>
      {canRetry && message.session_id && code && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={retry.isPending}
          onClick={() =>
            retry.mutate({ messageId: message.id, sessionId: message.session_id!, sessionCode: code, question: message.body })
          }
        >
          <RefreshCw className={`h-4 w-4 ${retry.isPending ? "animate-spin" : ""}`} />
          Chạy lại AI
        </Button>
      )}
    </InfoBox>
  );
}
