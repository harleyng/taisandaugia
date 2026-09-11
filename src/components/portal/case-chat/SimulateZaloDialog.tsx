import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { useOrgAuctionSessions } from "@/hooks/useAuctionSessions";
import { useSimulateZaloMessage } from "@/hooks/useOrgChat";
import { STANDARD_QUESTIONS } from "@/lib/caseQa/standardQuestions";

interface Props {
  onClose: () => void;
  onSent: (conversationId: string) => void;
}

const PHONE_RE = /^0\d{9}$/;

// Mẫu gồm cả câu tài liệu trả lời được lẫn câu PHẢI chuyển người.
const SAMPLES = [
  ...STANDARD_QUESTIONS.slice(0, 5).map((q) => q.question),
  "Có nên mua lô này không?",
  "Có chỗ đậu xe khi đi xem tài sản không?",
];

/** Giả lập tin nhắn Zalo OA — thử luồng trả lời khi chưa nối Zalo thật. */
export function SimulateZaloDialog({ onClose, onSent }: Props) {
  const { data: sessions = [] } = useOrgAuctionSessions();
  const usable = sessions.filter((s) => s.status !== "cancelled");
  const [sessionId, setSessionId] = useState("");
  const [name, setName] = useState("Nguyễn Văn Khách");
  const [phone, setPhone] = useState("0901234567");
  const [body, setBody] = useState("");
  const simulate = useSimulateZaloMessage();

  const session = usable.find((s) => s.id === (sessionId || usable[0]?.id));
  const valid = !!session && name.trim().length >= 2 && PHONE_RE.test(phone) && body.trim().length >= 2;

  const submit = () => {
    if (!session) return;
    simulate.mutate(
      { sessionId: session.id, sessionCode: session.code ?? "", senderName: name, senderPhone: phone, body },
      {
        onSuccess: (result) => {
          if (result.conversation_id) onSent(result.conversation_id);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Giả lập tin nhắn Zalo</DialogTitle>
          <DialogDescription>
            Tin nhắn đi qua đúng luồng thật: AI soạn câu trả lời từ tài liệu phiên, áp cấu hình tự gửi của tổ chức.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <InfoBox variant="muted" className="text-xs">
            Chưa kết nối Zalo OA. Hội thoại tạo ở đây được gắn nhãn “Giả lập” và không gửi gì ra ngoài.
          </InfoBox>

          <div className="space-y-1.5">
            <Label>Phiên đấu giá người hỏi đang quan tâm</Label>
            {usable.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tổ chức chưa có phiên nào (hoặc bạn chưa có quyền xem phiên).</p>
            ) : (
              <Select value={session?.id ?? ""} onValueChange={setSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phiên" />
                </SelectTrigger>
                <SelectContent>
                  {usable.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} · {s.title}
                      {s.status === "draft" ? " (nháp)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sim-name">Tên Zalo</Label>
              <Input id="sim-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-phone">Số điện thoại</Label>
              <Input
                id="sim-phone"
                inputMode="numeric"
                value={phone}
                maxLength={10}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sim-body">Nội dung tin nhắn</Label>
            <Textarea id="sim-body" value={body} rows={3} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBody(s)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={simulate.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!valid || simulate.isPending} className="gap-1.5">
            {simulate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Gửi tin giả lập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
