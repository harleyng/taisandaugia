import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { InfoBox } from "@/components/shared/InfoBox";
import { CASE_EXTRACTION_STAGES, type CaseExtractionState } from "@/hooks/useCaseDocumentExtraction";

interface Props {
  state: CaseExtractionState;
  progress: number;
  onDismiss: () => void;
}

export function ExtractionProgress({ state, progress, onDismiss }: Props) {
  if (state.phase === "idle") return null;

  if (state.phase === "running") {
    return (
      <div className="space-y-1.5 border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">{CASE_EXTRACTION_STAGES[state.stage]}</p>
        <Progress value={progress} className="h-1.5" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="border-t border-border px-4 py-3">
        <InfoBox variant="amber" className="flex items-start justify-between gap-2 text-xs">
          <span>{state.message}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onDismiss}>
            Đóng
          </Button>
        </InfoBox>
      </div>
    );
  }

  const { result } = state;
  return (
    <div className="border-t border-border px-4 py-3">
      <InfoBox variant="amber" className="space-y-1 text-xs">
        <p className="font-semibold">
          Đã tạo {result.clauses.length} điều khoản NHÁP · còn {result.placeholderCount} chỗ [[CẦN NHẬP]]
        </p>
        <p>
          Đây là trích xuất giả lập ({result.engineLabel}), không đọc nội dung tệp. Đối chiếu từng điều khoản với tệp
          gốc, điền chỗ trống rồi mới xác nhận.
        </p>
        {result.warnings.map((w) => (
          <p key={w}>• {w}</p>
        ))}
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onDismiss}>
          Đã hiểu
        </Button>
      </InfoBox>
    </div>
  );
}
