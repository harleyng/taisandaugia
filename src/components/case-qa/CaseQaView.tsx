import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoBox } from "@/components/shared/InfoBox";
import { useCitableClauses } from "@/hooks/useCitableClauses";
import { AskQuestionCard } from "./AskQuestionCard";
import { CaseClauseDirectory } from "./CaseClauseDirectory";
import { CaseFaqList } from "./CaseFaqList";
import { MyQuestionsList } from "./MyQuestionsList";

export interface CaseQaSession {
  id: string;
  code: string | null;
  title: string;
  status: string;
  ends_at: string;
}

interface Props {
  session: CaseQaSession;
  /** preview = portal xem trước (phiên có thể còn nháp): không có ô gửi câu hỏi. */
  mode: "public" | "preview";
}

/** Trang hỏi đáp một phiên — dùng chung cho sàn (/sessions/:id/hoi-dap) và bản xem trước ở portal. */
export function CaseQaView({ session, mode }: Props) {
  const { data: clauses = [], isLoading } = useCitableClauses(session.id);
  const [prefill, setPrefill] = useState("");
  const askRef = useRef<HTMLDivElement>(null);
  const acceptsQuestions =
    mode === "public" && session.status === "published" && new Date(session.ends_at).getTime() > Date.now();

  const askAbout = (question: string) => {
    setPrefill(question);
    askRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <InfoBox variant="primary" className="flex items-start gap-3 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Mọi câu trả lời đều trích nguyên văn tài liệu của phiên này</p>
            <p className="text-muted-foreground">
              Không dùng thông tin từ phiên khác hay kiến thức chung. Điều tài liệu chưa nêu sẽ được chuyển cho chuyên
              viên của tổ chức đấu giá. Tài liệu gốc do tổ chức phát hành có giá trị cuối cùng.
            </p>
          </div>
        </InfoBox>

        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : clauses.length === 0 ? (
          <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Tổ chức đấu giá chưa công bố tài liệu phiên để tra cứu.
            {acceptsQuestions && " Bạn vẫn có thể gửi câu hỏi cho chuyên viên."}
          </Card>
        ) : (
          <>
            <CaseFaqList
              clauses={clauses}
              sessionCode={session.code ?? ""}
              onAsk={acceptsQuestions ? askAbout : undefined}
            />
            <CaseClauseDirectory clauses={clauses} />
          </>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {mode === "preview" ? (
          <Card className="rounded-2xl p-4 text-sm text-muted-foreground">
            Bản xem trước: ô gửi câu hỏi chỉ hiện trên sàn khi phiên đã công bố và chưa kết thúc.
          </Card>
        ) : acceptsQuestions ? (
          <div ref={askRef} className="scroll-mt-24">
            <AskQuestionCard session={session} prefill={prefill} />
          </div>
        ) : (
          <Card className="rounded-2xl p-4 text-sm text-muted-foreground">
            Phiên đã kết thúc hoặc đã huỷ — không nhận câu hỏi mới.
          </Card>
        )}
        {mode === "public" && <MyQuestionsList sessionId={session.id} />}
      </aside>
    </div>
  );
}
