import { Check, Sparkles, X } from "lucide-react";
import { confidenceLabel, type ExtractedField } from "@/lib/aiMediaExtraction";

interface Props {
  field: ExtractedField;
  /** Trường đang có dữ liệu — dùng gợi ý là ghi đè, phải nói rõ. */
  hasValue: boolean;
  onUse: () => void;
  onDismiss: () => void;
}

/**
 * Gợi ý AI cho MỘT trường, hiện ngay dưới ô nhập của chính trường đó.
 *
 * Cố ý không dùng dialog tổng: người dùng đọc gợi ý ngay cạnh ô mình đang nhìn,
 * thấy luôn giá trị hiện có để so sánh, và quyết định từng trường một — thay vì
 * phải nhớ 8 dòng trong một popup rồi đối chiếu ngược lại với form.
 */
export function AiFieldSuggestion({ field, hasValue, onUse, onDismiss }: Props) {
  const conf = confidenceLabel(field.confidence);
  const confClass =
    conf.tone === "ok"
      ? "text-success"
      : conf.tone === "req"
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.04] px-2.5 py-2">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[11px] font-semibold text-primary">AI đề xuất</span>
            <span className={`text-[11px] font-medium ${confClass}`}>
              {conf.text} · {Math.round(field.confidence * 100)}%
            </span>
          </div>
          <p className="mt-0.5 break-words text-[13px] font-medium text-foreground">{field.display}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{field.evidence}</p>
          {hasValue && (
            <p className="mt-0.5 text-[11px] text-warning">Dùng gợi ý này sẽ ghi đè giá trị bạn đã nhập.</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onUse}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Check className="h-3 w-3" /> Dùng
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Bỏ qua gợi ý"
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
