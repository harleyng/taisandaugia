import { cn } from "@/lib/utils";
import type { TargetPeriodType } from "@/lib/ownerTargets";
import { periodTileParts } from "@/lib/ownerTargetView";

// Bản thiết kế tô tháng xanh lá, quý xanh dương, năm vàng. Không có token xanh dương ⇒
// quý dùng sắc trung tính của chữ; chữ trên nền vàng dùng màu chữ chính cho đủ tương phản.
const TYPE_TONE: Record<TargetPeriodType, string> = {
  month: "bg-primary/10 text-primary-hover",
  quarter: "bg-foreground/[0.07] text-foreground",
  year: "bg-accent/20 text-foreground",
};

const SIZE = {
  /** Dòng danh sách: 44px ở màn hẹp, 52px khi đủ chỗ cho cả cột phạm vi. */
  row: {
    box: "h-11 w-11 rounded-[11px] xl:h-[52px] xl:w-[52px]",
    big: "text-base xl:text-lg",
  },
  /** Đầu trang chi tiết. */
  header: { box: "h-[60px] w-[60px] rounded-[13px]", big: "text-[21px]" },
} as const;

interface PeriodTileProps {
  type: TargetPeriodType;
  start: string;
  size?: keyof typeof SIZE;
  /** Kỳ sắp tới / đã qua trên danh sách: ô xám. */
  muted?: boolean;
  className?: string;
}

/** Ô kỳ "Tháng 9" · "Quý III" · "Năm 26". */
export function PeriodTile({ type, start, size = "row", muted = false, className }: PeriodTileProps) {
  const { small, big } = periodTileParts(type, start);
  const s = SIZE[size];
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-[3px] leading-none",
        s.box,
        muted ? "bg-muted text-muted-foreground" : TYPE_TONE[type],
        className,
      )}
    >
      <small className="text-[10px] font-bold uppercase tracking-[0.06em] opacity-80">{small}</small>
      <b className={cn("font-[750] tracking-[-0.02em]", s.big)}>{big}</b>
    </div>
  );
}
