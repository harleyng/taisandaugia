import { Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "./CopyButton";
import { OutreachFieldEditor } from "./OutreachFieldEditor";
import { CHANNEL_KEYS, CHANNEL_LABELS, channelFieldKey, type ChannelKey } from "@/lib/outreach/fieldKeys";
import { printFlyer } from "@/lib/outreach/printFlyer";
import type { OutreachEdit, OutreachField, OutreachSend } from "@/types/outreach";

const HINTS: Record<ChannelKey, string> = {
  listing: "Đăng lên website tổ chức, sàn, cổng thông tin.",
  zalo: "Đăng nhóm / trang Zalo OA của tổ chức.",
  facebook: "Đăng fanpage / nhóm Facebook.",
  sms: "Gửi hàng loạt qua brandname — không dấu, tối đa 160 ký tự.",
  flyer: "In A4 để phát tại nơi có tài sản, trụ sở.",
};

interface Props {
  sessionId: string;
  sessionTitle: string;
  packId: string | null;
  fieldsByKey: Map<string, OutreachField>;
  editsByKey: Map<string, OutreachEdit[]>;
  sends: OutreachSend[];
  readOnly: boolean;
  sendGate: { allowed: boolean; reason: string | null };
  onMarkSent: (channel: ChannelKey, text: string) => void;
}

export function ChannelDraftsCard({
  sessionId, sessionTitle, packId, fieldsByKey, editsByKey, sends, readOnly, sendGate, onMarkSent,
}: Props) {
  const sentCount = (c: ChannelKey) => sends.filter((s) => s.channel === c).length;

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="font-semibold text-foreground">Bản đăng theo kênh</h2>
        <p className="text-sm text-muted-foreground">
          Sao chép để tự đăng, rồi bấm "Đánh dấu đã đăng" — hệ thống lưu đúng nội dung tại thời điểm đánh dấu.
          {!sendGate.allowed && sendGate.reason ? ` ${sendGate.reason}` : ""}
        </p>
      </div>

      <Tabs defaultValue="listing">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {CHANNEL_KEYS.map((c) => (
            <TabsTrigger key={c} value={c}>
              {CHANNEL_LABELS[c]}
              {sentCount(c) > 0 && <span className="ml-1 text-xs text-success">✓{sentCount(c)}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        {CHANNEL_KEYS.map((c) => {
          const key = channelFieldKey(c);
          return (
            <TabsContent key={c} value={c} className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">{HINTS[c]}</p>
              <OutreachFieldEditor
                sessionId={sessionId}
                packId={packId}
                fieldKey={key}
                field={fieldsByKey.get(key)}
                edits={editsByKey.get(key) ?? []}
                readOnly={readOnly}
                rows={c === "sms" ? 3 : 14}
                sms={c === "sms"}
                renderActions={(value) => (
                  <>
                    <CopyButton text={value} />
                    {c === "flyer" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={!value.trim()}
                        onClick={() => {
                          if (!printFlyer(value, sessionTitle)) toast.error("Trình duyệt chặn cửa sổ in.");
                        }}
                      >
                        <Printer className="h-4 w-4" />
                        In tờ rơi
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!sendGate.allowed || !value.trim()}
                      title={sendGate.allowed ? undefined : sendGate.reason ?? undefined}
                      onClick={() => onMarkSent(c, value)}
                    >
                      <Send className="h-4 w-4" />
                      Đánh dấu đã đăng
                    </Button>
                  </>
                )}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </Card>
  );
}
