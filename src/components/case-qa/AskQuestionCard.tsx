import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAskCaseQuestion } from "@/hooks/useCaseQuestions";
import { useProfile } from "@/hooks/useProfile";
import type { QaRpcResult } from "@/types/case-chat";

interface Props {
  session: { id: string; code: string | null };
  /** Câu hỏi điền sẵn khi bấm "Gửi câu hỏi" ở một câu FAQ tài liệu chưa nêu. */
  prefill: string;
}

const PHONE_RE = /^0\d{9}$/;

function AskResult({ result }: { result: QaRpcResult }) {
  if (result.state === "auto_answered" && result.answer) {
    return (
      <div className="space-y-1">
        <p className="whitespace-pre-line rounded-lg bg-muted p-3 text-sm text-foreground">{result.answer.body}</p>
        <p className="text-[11px] text-muted-foreground">Trích nguyên văn tài liệu phiên — tài liệu gốc có giá trị cuối cùng.</p>
      </div>
    );
  }
  if (result.state === "draft_ready") {
    return (
      <InfoBox variant="muted" className="text-xs">
        Đã nhận câu hỏi. Câu trả lời trích từ tài liệu phiên đang chờ chuyên viên xác nhận — xem ở mục “Câu hỏi của tôi”.
      </InfoBox>
    );
  }
  return (
    <InfoBox variant="amber" className="text-xs">
      Tài liệu phiên chưa nêu nội dung này. Câu hỏi đã được chuyển cho chuyên viên của tổ chức đấu giá — câu trả lời sẽ
      hiện ở mục “Câu hỏi của tôi”.
    </InfoBox>
  );
}

export function AskQuestionCard({ session, prefill }: Props) {
  const { userId } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const { data: profile } = useProfile(userId);
  const ask = useAskCaseQuestion(session);
  const [question, setQuestion] = useState(prefill);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [lastResult, setLastResult] = useState<QaRpcResult | null>(null);

  useEffect(() => {
    if (prefill) setQuestion(prefill);
  }, [prefill]);

  const contactName = name ?? profile?.name ?? "";
  const phoneOk = phone.trim() === "" || PHONE_RE.test(phone.trim());
  const valid = question.trim().length >= 5 && contactName.trim().length >= 2 && phoneOk;

  const submit = () =>
    ask.mutate(
      { question, contactName, contactPhone: phone },
      {
        onSuccess: (result) => {
          setLastResult(result);
          setQuestion("");
        },
      },
    );

  return (
    <Card className="space-y-3 rounded-2xl p-4">
      <div>
        <h3 className="font-semibold text-foreground">Gửi câu hỏi cho tổ chức đấu giá</h3>
        <p className="text-xs text-muted-foreground">
          Nếu tài liệu phiên có câu trả lời, bạn nhận câu trả lời kèm trích dẫn. Nếu chưa có, chuyên viên sẽ phản hồi.
        </p>
      </div>

      {!userId ? (
        <Button className="w-full" onClick={() => openAuthDialog()}>
          Đăng nhập để gửi câu hỏi
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ask-question">Câu hỏi</Label>
            <Textarea
              id="ask-question"
              value={question}
              rows={4}
              maxLength={1000}
              placeholder="Vd: Hạn nộp tiền đặt trước là khi nào?"
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ask-name">Họ tên</Label>
              <Input id="ask-name" value={contactName} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ask-phone">Số điện thoại (không bắt buộc)</Label>
              <Input
                id="ask-phone"
                inputMode="numeric"
                value={phone}
                maxLength={10}
                placeholder="09xxxxxxxx"
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
              {!phoneOk && <p className="text-xs text-destructive">Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.</p>}
            </div>
          </div>
          <Button className="w-full gap-1.5" onClick={submit} disabled={!valid || ask.isPending}>
            {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Gửi câu hỏi
          </Button>
        </div>
      )}

      {lastResult && <AskResult result={lastResult} />}
    </Card>
  );
}
