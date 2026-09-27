import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface InfoAiBarProps {
  /** idle chưa chạy · run đang chạy · done có kết quả · stale ảnh/loại đã đổi · error không trích được. */
  phase: "idle" | "run" | "done" | "stale" | "error";
  /** Số gợi ý còn chờ duyệt (phase done). */
  pending: number;
  errorMessage?: string;
  onRun: () => void;
  onApplyAll: () => void;
}

/**
 * Thanh "AI điền giúp từ ảnh" dưới lưới ảnh (thiết kế v3). Chạy THỦ CÔNG — khi
 * nối API thật, mỗi lượt là một lần gọi tính phí. Gợi ý từng trường hiện ngay
 * dưới ô tương ứng (InfoSuggestion), thanh này chỉ điều khiển lượt phân tích.
 */
export function InfoAiBar({ phase, pending, errorMessage, onRun, onApplyAll }: InfoAiBarProps) {
  const title =
    phase === "idle"
      ? "AI điền giúp từ ảnh"
      : phase === "run"
        ? "Đang phân tích ảnh…"
        : phase === "stale"
          ? "Ảnh hoặc loại tài sản đã đổi — phân tích lại để có gợi ý đúng"
          : phase === "error"
            ? errorMessage ?? "Không trích xuất được thông tin"
            : pending
              ? `AI gợi ý ${pending} thông tin`
              : "Đã áp dụng gợi ý AI";

  const btn = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3.5 py-[9px] text-[13px] font-semibold transition";
  const solid = `${btn} bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-80`;
  const ghost = `${btn} border border-violet-100 bg-card text-violet-600 hover:bg-violet-50`;

  return (
    <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-violet-100 bg-violet-50 px-3 py-2.5">
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-card text-violet-600">
        {phase === "done" ? <Check className="h-[17px] w-[17px]" /> : <Sparkles className="h-[17px] w-[17px]" />}
      </span>
      <div className="min-w-0 flex-1 text-sm font-bold text-violet-950">{title}</div>
      {phase === "idle" && (
        <button type="button" className={solid} onClick={onRun}>
          <Sparkles className="h-3.5 w-3.5" /> Phân tích ảnh
        </button>
      )}
      {phase === "run" && (
        <button type="button" className={solid} disabled>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang phân tích
        </button>
      )}
      {phase === "done" && pending > 0 && (
        <button type="button" className={solid} onClick={onApplyAll}>
          Áp dụng tất cả
        </button>
      )}
      {((phase === "done" && !pending) || phase === "stale" || phase === "error") && (
        <button type="button" className={ghost} onClick={onRun}>
          {phase !== "done" && <RefreshCw className="h-3.5 w-3.5" />} Phân tích lại
        </button>
      )}
    </div>
  );
}
