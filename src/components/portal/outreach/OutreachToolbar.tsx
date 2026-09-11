import { AlertTriangle, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GENERATION_STAGES, useOutreachGeneration } from "@/hooks/useOutreachGeneration";
import { useApplyGeneration } from "@/hooks/useSessionOutreach";
import { draftFieldValues } from "@/lib/outreach/generateOutreach";
import type { OutreachInput } from "@/lib/outreach/outreachInput";
import type { OutreachPack } from "@/types/outreach";

interface Props {
  sessionId: string;
  pack: OutreachPack | null;
  input: OutreachInput | null;
  currentSignature: string | null;
  readOnly: boolean;
  hasFields: boolean;
}

const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export function OutreachToolbar({ sessionId, pack, input, currentSignature, readOnly, hasFields }: Props) {
  const gen = useOutreachGeneration();
  const apply = useApplyGeneration(sessionId);
  const running = gen.state.phase === "running" || apply.isPending;
  const stale = !!pack?.input_signature && !!currentSignature && pack.input_signature !== currentSignature;

  const runGeneration = async () => {
    if (!pack || !input) return;
    try {
      const draft = await gen.run(input);
      apply.mutate({ packId: pack.id, fields: draftFieldValues(draft), label: draft.modelLabel, signature: draft.signature });
    } catch {
      /* lỗi đã hiện qua gen.state */
    }
  };

  return (
    <Card className="space-y-3 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">Gói tiếp thị</h2>
          <p className="text-sm text-muted-foreground">
            Trình soạn viết bản đăng từng kênh, ô mô tả của thông báo và câu chào theo phân khúc từ hồ sơ phiên. Mọi
            trường sửa được và mọi lần sửa đều được ghi nhật ký. Trình soạn không bao giờ đè bản bạn đã sửa tay.
          </p>
          {pack?.generated_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              Soạn lần cuối {when(pack.generated_at)} · {pack.generator_label}
            </p>
          )}
        </div>
        {!readOnly && (
          <Button className="gap-1.5" onClick={runGeneration} disabled={running || !input || !input.lots.length}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {hasFields ? "Soạn lại" : "Soạn gói tiếp thị"}
          </Button>
        )}
      </div>

      {gen.state.phase === "running" && (
        <div className="space-y-1.5">
          <Progress value={gen.progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{GENERATION_STAGES[gen.state.stage]}</p>
        </div>
      )}
      {gen.state.phase === "error" && <p className="text-sm text-destructive">{gen.state.message}</p>}
      {stale && hasFields && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          Thông tin phiên, hồ sơ vụ việc hoặc danh sách phân khúc đã đổi sau lần soạn gần nhất. Kiểm tra lại bản nháp
          hoặc bấm "Soạn lại" trước khi gửi.
        </p>
      )}
    </Card>
  );
}
