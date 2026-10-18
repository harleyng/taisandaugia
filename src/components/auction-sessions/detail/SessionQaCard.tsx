import { useMemo, useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { useCitableClauses } from "@/hooks/useCitableClauses";
import { buildCaseFaq } from "@/lib/caseQa/coverage";
import type { CaseTopic } from "@/types/case-qa";
import type { PublicSessionDetail } from "@/types/auction-session";
import { SessionChatWidget } from "./SessionChatWidget";
import { SectionCard } from "./ui";

/** Chủ đề ưu tiên cho 3 câu gợi ý — người mua hỏi nhiều nhất trước khi mua hồ sơ. */
const PREFERRED: CaseTopic[] = ["deposit_method", "proxy", "deposit_refund", "deposit_deadline", "viewing", "documents_required"];
const QUICK_COUNT = 3;

/**
 * "Hỏi đáp về phiên" ở cột phải + nút nổi "Hỏi về phiên" mở hộp chat.
 * Câu gợi ý = câu chuẩn mà tài liệu phiên TRẢ LỜI ĐƯỢC (buildCaseFaq), để bấm là có
 * trích dẫn ngay.
 */
export function SessionQaCard({ session }: { session: PublicSessionDetail }) {
  const { data: clauses = [] } = useCitableClauses(session.id);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const quick = useMemo(() => {
    const answered = buildCaseFaq(clauses, session.code ?? "").filter((e) => e.citations.length > 0);
    const rank = (t: CaseTopic) => (PREFERRED.includes(t) ? PREFERRED.indexOf(t) : PREFERRED.length);
    return [...answered].sort((a, b) => rank(a.topic) - rank(b.topic)).slice(0, QUICK_COUNT).map((e) => e.question);
  }, [clauses, session.code]);

  const acceptsQuestions = session.status === "published" && Date.parse(session.ends_at) > Date.now();
  const openWith = (q: string | null) => {
    setPending(q);
    setOpen(true);
  };

  return (
    <>
      <SectionCard icon={MessageCircle} title="Hỏi đáp về phiên">
        <div className="flex flex-col gap-2 px-4 pb-4">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => openWith(q)}
              className="flex items-center gap-2.5 rounded-xl bg-muted px-3 py-2.5 text-left text-[13px] leading-snug text-foreground transition-colors hover:bg-primary/10"
            >
              <span className="flex-1">{q}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => openWith(null)}
            className="rounded-xl bg-card px-3 py-2.5 text-left text-[13px] text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted"
          >
            Hỏi điều khác về phiên này…
          </button>
        </div>
      </SectionCard>
      <SessionChatWidget
        session={session}
        clauses={clauses}
        quick={quick}
        acceptsQuestions={acceptsQuestions}
        open={open}
        onOpenChange={setOpen}
        pending={pending}
        onPendingConsumed={() => setPending(null)}
      />
    </>
  );
}
