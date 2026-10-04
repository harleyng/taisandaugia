import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { stageBarPct, type FunnelStage } from "@/lib/ownerMarketing/funnel";

interface FunnelBarsProps {
  stages: FunnelStage[];
  /** Giá trúng / giá khởi điểm (%), in cạnh giai đoạn "Kết quả". */
  priceRatio: number | null;
  /** Bản in / link chia sẻ: không tooltip (giải thích in thành chú thích ở dưới). */
  print?: boolean;
}

/** Hai giai đoạn cuối là kết quả phiên của tài sản — không quy được cho nguồn nào. */
const CONTEXT_STAGES = new Set(["participants", "sold"]);

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Phễu §B5 dạng thanh ngang một màu (một chuỗi số ⇒ không chú giải). Bề rộng so với giai
 * đoạn lớn nhất; số in thẳng cạnh thanh. Rê / chạm một dòng để xem số lấy từ đâu.
 */
export function FunnelBars({ stages, priceRatio, print = false }: FunnelBarsProps) {
  const max = Math.max(0, ...stages.map((s) => s.value));

  const row = (s: FunnelStage) => {
    const pct = stageBarPct(s.value, max);
    const value = s.key === "sold" && priceRatio !== null ? `${fmt(s.value)} · ${priceRatio}% giá khởi điểm` : fmt(s.value);
    const body = (
      <div
        className={cn(
          "grid grid-cols-[7.5rem_1fr] items-center gap-3 rounded-lg px-1 py-1.5 sm:grid-cols-[10rem_1fr_auto]",
          !print && "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
        )}
        tabIndex={print ? undefined : 0}
        aria-label={`${s.label}: ${value}`}
      >
        <span className="truncate text-sm text-foreground">{s.label}</span>
        <div className="h-2.5 rounded-full bg-muted print:border" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="col-start-2 text-right text-sm font-semibold tabular-nums text-foreground sm:col-start-auto sm:min-w-[4.5rem]">
          {value}
        </span>
      </div>
    );
    if (print) return <li key={s.key}>{body}</li>;
    return (
      <li key={s.key}>
        <Tooltip>
          <TooltipTrigger asChild>{body}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {s.hint}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  };

  const attributed = stages.filter((s) => !CONTEXT_STAGES.has(s.key));
  const context = stages.filter((s) => CONTEXT_STAGES.has(s.key));

  return (
    <div className="space-y-2">
      <ol className="space-y-0.5">{attributed.map(row)}</ol>
      {context.length > 0 && (
        <>
          <p className="border-t pt-2 text-xs text-muted-foreground">
            Kết quả phiên của các tài sản đang truyền thông — mọi nguồn, không quy cho kênh nào.
          </p>
          <ol className="space-y-0.5">{context.map(row)}</ol>
        </>
      )}
      {print && (
        <p className="text-xs text-muted-foreground">
          Gửi / Mở: email và banner của gói sàn làm. Bấm / Xem: lượt mở link theo dõi và lượt bấm email, banner. Lưu /
          Đăng ký: chỉ những lượt tới từ link theo dõi trong 30 ngày.
        </p>
      )}
    </div>
  );
}
