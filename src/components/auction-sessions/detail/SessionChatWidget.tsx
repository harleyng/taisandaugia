import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CitationQuote } from "@/components/case-qa/CitationQuote";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAskCaseQuestion } from "@/hooks/useCaseQuestions";
import { useProfile } from "@/hooks/useProfile";
import { answerCaseQuestion } from "@/lib/caseQa/answerEngine";
import { clauseAnchorId } from "@/lib/caseQa/citations";
import { snapshotCitations } from "@/lib/caseQa/compose";
import type { CitationSnapshot, EngineClause } from "@/types/case-qa";
import { Pill } from "./ui";

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; question: string; citations: CitationSnapshot[]; sent?: boolean };

interface Props {
  session: { id: string; code: string | null };
  clauses: EngineClause[];
  quick: string[];
  /** Phiên còn nhận câu hỏi (đã công bố, chưa kết thúc) — mới cho chuyển chuyên viên. */
  acceptsQuestions: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Câu hỏi cần hỏi ngay khi mở (bấm câu gợi ý ở thẻ Hỏi đáp). */
  pending: string | null;
  onPendingConsumed: () => void;
}

/**
 * Hộp hỏi đáp nổi của trang phiên. Trả lời NGAY trên trình duyệt bằng engine
 * trích dẫn (cùng engine FAQ công khai) — chỉ trích nguyên văn điều khoản đã xác
 * nhận. Không trả lời được ⇒ mời gửi chuyên viên qua RPC ask_case_question (server
 * tự kiểm trích dẫn và dựng câu trả lời; cần đăng nhập).
 */
export function SessionChatWidget({
  session,
  clauses,
  quick,
  acceptsQuestions,
  open,
  onOpenChange,
  pending,
  onPendingConsumed,
}: Props) {
  const { userId, session: auth } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const { data: profile } = useProfile(userId);
  const ask = useAskCaseQuestion(session);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const submit = (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setMsgs((m) => [...m, { id: ++seq.current, role: "user", text: question }]);
    setBusy(true);
    window.setTimeout(() => {
      const proposal = answerCaseQuestion({ question, sessionCode: session.code, clauses });
      const citations = proposal.outcome === "answer" ? snapshotCitations(proposal.citations, clauses) : [];
      setMsgs((m) => [...m, { id: ++seq.current, role: "bot", question, citations }]);
      setBusy(false);
    }, 600);
  };

  useEffect(() => {
    if (!open) return;
    if (pending) {
      submit(pending);
      onPendingConsumed();
    } else {
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
    // submit đọc state mới nhất qua setter; chỉ chạy khi mở / có câu chờ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const escalate = (msg: Extract<Msg, { role: "bot" }>) => {
    const send = () =>
      ask.mutate(
        {
          question: msg.question,
          contactName: profile?.name?.trim() || auth?.user.email?.split("@")[0] || "Người mua",
          contactPhone: "",
        },
        { onSuccess: () => setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...x, sent: true } : x))) },
      );
    if (userId) send();
    else openAuthDialog(send);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(text);
    setText("");
  };

  const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => (m as { text: string }).text));
  const left = quick.filter((q) => !asked.has(q));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="fixed bottom-5 right-5 z-[55] flex h-[52px] items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-sm font-semibold text-primary-foreground shadow-xl transition-transform hover:-translate-y-0.5"
      >
        <MessageCircle className="h-5 w-5" />
        Hỏi về phiên
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-foreground/30 sm:inset-auto sm:bottom-0 sm:right-0 sm:max-w-full sm:bg-transparent sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-label="Hỏi đáp về phiên"
        className="flex h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:h-[min(640px,calc(100vh-32px))] sm:w-[400px] sm:rounded-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <MessageCircle className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <b className="block text-sm text-foreground">Hỏi đáp về phiên</b>
            {session.code && <span className="font-mono text-xs text-muted-foreground">{session.code}</span>}
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="flex flex-1 flex-col gap-2.5 overflow-auto p-4">
          <Bubble bot>
            Xin chào! Mình trả lời dựa trên tài liệu của phiên này và trích dẫn nguồn. Điều tài liệu chưa nêu sẽ được
            chuyển cho chuyên viên.
          </Bubble>
          {msgs.map((m) =>
            m.role === "user" ? (
              <Bubble key={m.id}>{m.text}</Bubble>
            ) : (
              <Bubble key={m.id} bot>
                {m.citations.length > 0 ? (
                  <>
                    {m.citations.map((c) => (
                      <CitationQuote key={c.clause_id} citation={c} className="border-0 bg-card" />
                    ))}
                    <Link
                      to={`/sessions/${session.id}/hoi-dap#${clauseAnchorId(m.citations[0].clause_id)}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Xem điều khoản
                    </Link>
                  </>
                ) : (
                  <>
                    <span>
                      Tài liệu phiên chưa nêu nội dung này.
                      {acceptsQuestions
                        ? " Mình có thể chuyển câu hỏi cho chuyên viên của tổ chức đấu giá — bạn sẽ nhận câu trả lời ở mục hỏi đáp của phiên."
                        : " Phiên không còn nhận câu hỏi mới."}
                    </span>
                    {acceptsQuestions &&
                      (m.sent ? (
                        <Pill tone="amber">Đã gửi · chờ chuyên viên</Pill>
                      ) : (
                        <Button size="sm" variant="secondary" className="self-start bg-primary/10 text-primary hover:bg-primary/15" disabled={ask.isPending} onClick={() => escalate(m)}>
                          Gửi cho chuyên viên
                        </Button>
                      ))}
                  </>
                )}
              </Bubble>
            ),
          )}
          {busy && (
            <Bubble bot>
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <i key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </Bubble>
          )}
        </div>

        {left.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2.5">
            {left.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => submit(q)}
                className="rounded-full px-2.5 py-1.5 text-xs ring-1 ring-border hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-border px-4 pb-3.5 pt-3">
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="Nhập câu hỏi về phiên…"
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-muted"
          />
          <Button type="submit" disabled={!text.trim() || busy}>
            Gửi
          </Button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ bot, children }: { bot?: boolean; children: React.ReactNode }) {
  return bot ? (
    <div className="flex max-w-[88%] flex-col gap-2 self-start rounded-[14px] rounded-bl bg-muted px-3 py-2.5 text-[13.5px] leading-snug text-foreground">
      {children}
    </div>
  ) : (
    <div className="max-w-[88%] self-end rounded-[14px] rounded-br bg-primary px-3 py-2.5 text-[13.5px] leading-snug text-primary-foreground">
      {children}
    </div>
  );
}
