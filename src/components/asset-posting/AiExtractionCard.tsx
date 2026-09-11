import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { EXTRACTION_STAGES, type UseAiMediaExtraction } from "@/hooks/useAiMediaExtraction";
import { mediaSignature } from "@/lib/aiMediaExtraction";
import { applyExtractedFields, type WizardValues } from "./wizardSchema";

interface Props {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  ai: UseAiMediaExtraction;
}

/**
 * Entry point "Trích xuất thông tin bằng AI".
 *
 * Chạy THỦ CÔNG (bấm nút) chứ không tự chạy khi upload xong: khi đây là lệnh gọi
 * API thật thì mỗi lần upload thử một tấm ảnh cũng tốn một lượt, và người dùng
 * không có cách nào ngăn.
 *
 * Card này chỉ điều khiển LƯỢT phân tích. Kết quả từng trường hiện ngay dưới ô
 * nhập tương ứng qua <AiFieldSuggestion>, không gom vào popup.
 */
export function AiExtractionCard({ f, up, ai }: Props) {
  const { state, progress, resolved, run, resolve, reset } = ai;

  if (f.imageUrls.length === 0) return null;

  const signature = mediaSignature({
    childSlug: f.childSlug,
    imageUrls: f.imageUrls,
    videoUrls: f.videoUrls,
  });
  const stale = state.phase === "done" && state.result.signature !== signature;
  const pending =
    state.phase === "done" && !stale ? state.result.fields.filter((x) => !resolved.has(x.path)) : [];

  const start = () =>
    run({
      parentSlug: f.parentSlug,
      childSlug: f.childSlug,
      province: f.province,
      imageUrls: f.imageUrls,
      videoUrls: f.videoUrls,
    });

  const applyAll = () => {
    const paths = pending.map((x) => x.path);
    up(applyExtractedFields(f, pending, new Set(paths)));
    resolve(paths);
    toast.success(`Đã điền ${paths.length} trường từ AI. Kiểm tra lại trước khi tiếp tục.`);
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-[13.5px] font-semibold text-foreground">Trích xuất thông tin bằng AI</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Beta
        </span>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        Để AI đọc {f.imageUrls.length} ảnh
        {f.videoUrls.length > 0 ? ` và ${f.videoUrls.length} video` : ""} rồi đề xuất điền giúp tên tài
        sản, khu vực và các thông số. Gợi ý sẽ hiện ngay dưới từng ô để bạn duyệt.
      </p>

      {state.phase === "running" && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {EXTRACTION_STAGES[state.stage]}
          </div>
          <Progress value={progress} className="mt-2 h-1.5" />
        </div>
      )}

      {state.phase === "error" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <p className="text-xs text-foreground">{state.message}</p>
        </div>
      )}

      {state.phase === "done" && !stale && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span className="text-xs font-medium text-foreground">
            {pending.length > 0
              ? `Còn ${pending.length}/${state.result.fields.length} gợi ý chờ bạn duyệt — xem ngay dưới từng ô nhập.`
              : `Đã duyệt xong cả ${state.result.fields.length} gợi ý.`}
          </span>
          {pending.length > 0 && (
            <>
              <div className="flex-1" />
              <button
                type="button"
                onClick={applyAll}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Dùng tất cả
              </button>
            </>
          )}
        </div>
      )}

      {stale && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <p className="text-xs text-foreground">
            Ảnh hoặc loại tài sản đã thay đổi từ lần phân tích trước. Hãy phân tích lại để có kết quả
            đúng.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={start}
          disabled={state.phase === "running"}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted-foreground/40"
        >
          {state.phase === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : state.phase === "idle" ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {state.phase === "running"
            ? "Đang phân tích…"
            : state.phase === "idle"
              ? "Trích xuất bằng AI"
              : "Phân tích lại"}
        </button>
        {(state.phase === "done" || state.phase === "error") && (
          <button
            type="button"
            onClick={reset}
            className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Bỏ kết quả
          </button>
        )}
      </div>
    </div>
  );
}
