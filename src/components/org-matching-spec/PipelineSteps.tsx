import { RichText } from "./RichText";
import type { SpecStage } from "./specContent";

/**
 * Bảy bước của luồng chấm điểm.
 *
 * Đánh số ở đây KHÔNG phải trang trí: thứ tự là thông tin — bước sau ăn đầu ra
 * của bước trước, nên đường nối dọc giữa các mốc là phần nội dung thật.
 */
export function PipelineSteps({ stages }: { stages: SpecStage[] }) {
  return (
    <ol className="flex flex-col">
      {stages.map((stage, i) => (
        <li key={stage.title} className="relative grid grid-cols-[34px_minmax(0,1fr)] gap-x-4 pb-6 last:pb-0">
          {i < stages.length - 1 && (
            <span aria-hidden className="absolute bottom-0 left-4 top-7 w-px bg-border" />
          )}
          <span
            className={`relative z-10 flex h-6 w-[33px] items-center justify-center rounded font-mono text-[11px] font-bold ${
              stage.mock ? "bg-warning text-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {i + 1}
          </span>
          <div>
            <h3 className="mb-1 text-base font-semibold leading-snug text-foreground">{stage.title}</h3>
            <p className="mb-1.5 max-w-[62ch] text-sm text-muted-foreground">
              <RichText text={stage.desc} />
            </p>
            <span className="font-mono text-[11px] text-muted-foreground/80">{stage.src}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
