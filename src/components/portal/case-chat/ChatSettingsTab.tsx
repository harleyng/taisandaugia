import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { useOrgChatSettings, useSaveOrgChatSettings } from "@/hooks/useOrgChatSettings";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { CHAT_MODE_LABELS } from "@/lib/caseQa/labels";
import type { ChatMode } from "@/types/case-qa";
import type { ChatSettingsInput } from "@/types/case-chat";

const CHANNELS: { key: "marketplace_mode" | "zalo_mode"; title: string; hint: string }[] = [
  { key: "marketplace_mode", title: "Câu hỏi trên sàn", hint: "Người mua hỏi ở trang hỏi đáp của phiên." },
  { key: "zalo_mode", title: "Tin nhắn Zalo", hint: "Tin nhắn Zalo OA (hiện đang giả lập)." },
];

/** Cấu hình trả lời tự động của tổ chức — ghi cần quyền `hoi-dap-cai-dat`. */
export function ChatSettingsTab() {
  const { data, isLoading } = useOrgChatSettings();
  const canEdit = useHasOrgPermission("hoi-dap-cai-dat", "update");
  const save = useSaveOrgChatSettings();
  const [draft, setDraft] = useState<ChatSettingsInput | null>(null);

  if (isLoading || !data) return <Skeleton className="h-72 rounded-2xl" />;

  const value: ChatSettingsInput = draft ?? {
    marketplace_mode: data.marketplace_mode,
    zalo_mode: data.zalo_mode,
    min_confidence: data.min_confidence,
    escalation_reply: data.escalation_reply,
  };
  const set = (patch: Partial<ChatSettingsInput>) => setDraft({ ...value, ...patch });
  const anyAuto = value.marketplace_mode === "auto_send" || value.zalo_mode === "auto_send";

  return (
    <Card className="space-y-5 rounded-2xl p-5">
      <div>
        <h2 className="font-semibold text-foreground">Trả lời tự động</h2>
        <p className="text-xs text-muted-foreground">
          {data.isDefault
            ? "Đang dùng mặc định an toàn: AI chỉ soạn nháp ở mọi kênh, chuyên viên duyệt trước khi gửi."
            : "Cấu hình riêng của tổ chức."}
        </p>
      </div>

      {!canEdit && (
        <InfoBox variant="muted" className="text-xs">
          Bạn chỉ xem được cấu hình. Cần quyền “Cấu hình trả lời tự động” để thay đổi.
        </InfoBox>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {CHANNELS.map((ch) => (
          <div key={ch.key} className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <p className="font-medium text-foreground">{ch.title}</p>
              <p className="text-xs text-muted-foreground">{ch.hint}</p>
            </div>
            <RadioGroup
              value={value[ch.key]}
              disabled={!canEdit}
              onValueChange={(v) => set({ [ch.key]: v as ChatMode })}
              className="space-y-2"
            >
              {(["draft", "auto_send"] as ChatMode[]).map((mode) => (
                <label key={mode} className="flex items-start gap-2 text-sm text-foreground">
                  <RadioGroupItem value={mode} className="mt-0.5" />
                  {CHAT_MODE_LABELS[mode]}
                </label>
              ))}
            </RadioGroup>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Ngưỡng tin cậy tối thiểu để tự gửi: {Math.round(value.min_confidence * 100)}%</Label>
        <Slider
          min={50}
          max={99}
          step={1}
          disabled={!canEdit}
          value={[Math.round(value.min_confidence * 100)]}
          onValueChange={([v]) => set({ min_confidence: v / 100 })}
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">Dưới ngưỡng thì AI vẫn soạn nháp, không tự gửi.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="escalation-reply">Tin nhắn chờ khi chuyển chuyên viên (chỉ gửi ở kênh bật tự gửi)</Label>
        <Textarea
          id="escalation-reply"
          value={value.escalation_reply}
          rows={3}
          maxLength={500}
          disabled={!canEdit}
          onChange={(e) => set({ escalation_reply: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Không ghi số tiền, thời hạn hay cam kết nào ở đây.</p>
      </div>

      {anyAuto && (
        <InfoBox variant="amber" className="text-xs">
          Tự gửi chỉ áp dụng cho câu trả lời mà MỌI trích dẫn khớp nguyên văn điều khoản đã xác nhận — server kiểm lại
          trước khi gửi. Câu hỏi ngoài tài liệu phiên luôn chuyển chuyên viên.
        </InfoBox>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button
            className="gap-1.5"
            disabled={!draft || save.isPending}
            onClick={() => draft && save.mutate(draft, { onSuccess: () => setDraft(null) })}
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu cấu hình
          </Button>
        </div>
      )}
    </Card>
  );
}
