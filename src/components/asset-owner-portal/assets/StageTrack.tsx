import { cn } from "@/lib/utils";
import { ASSET_PATH_STEPS, ASSET_PHASE_META, type AssetPhase } from "@/lib/ownerAssets";
import { PHASE_FILL } from "./assetsUi";

/** Thanh 4 bước nhỏ phía trên tên bước ở cột "Giai đoạn". */
export function StageTrack({ phase }: { phase: AssetPhase }) {
  const step = ASSET_PHASE_META[phase].step;
  return (
    <div className="mb-1.5 flex gap-[3px]" aria-hidden="true">
      {ASSET_PATH_STEPS.map((label, i) => (
        <i key={label} className={cn("h-1 w-4 rounded-sm", i <= step ? PHASE_FILL[phase] : "bg-border")} />
      ))}
    </div>
  );
}

/** Đường đi 4 bước trong popup chi tiết; bước hiện tại in tên bước cụ thể. */
export function StagePath({ phase, currentLabel }: { phase: AssetPhase; currentLabel: string }) {
  const step = ASSET_PHASE_META[phase].step;
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Tiến trình">
      {ASSET_PATH_STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === step ? "step" : undefined}
          className={cn(
            "flex flex-col gap-1.5 text-xs",
            i < step ? "text-muted-foreground" : i === step ? "font-semibold text-foreground" : "text-muted-foreground/70",
          )}
        >
          <span className={cn("h-[5px] rounded-full", i <= step ? PHASE_FILL[phase] : "bg-border")} />
          {i === step ? currentLabel : label}
        </li>
      ))}
    </ol>
  );
}
