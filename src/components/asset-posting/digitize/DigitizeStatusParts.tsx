import { cn } from "@/lib/utils";
import {
  DIGITIZE_TRACK,
  digitizeWhoLabel,
  type DigitizeStatus,
  type DigitizeTone,
} from "@/lib/asset-posting/digitizeStatus";

/** Màu chỉ nằm ở chấm tròn; chữ vàng nhỏ trên nền sáng không đủ tương phản (design-system). */
const TONE_DOT: Record<DigitizeTone, string> = {
  draft: "bg-muted-foreground/50",
  wait: "bg-foreground/45",
  me: "bg-warning",
  err: "bg-destructive",
  ok: "bg-success",
};

const TONE_TEXT: Record<DigitizeTone, string> = {
  draft: "text-muted-foreground",
  wait: "text-foreground/70",
  me: "text-foreground",
  err: "text-destructive",
  ok: "text-success",
};

/** "● Có báo giá" — nhãn trạng thái gộp. */
export function DigitizeStatusLabel({ status, className }: { status: DigitizeStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] whitespace-nowrap text-[12.5px] font-semibold",
        TONE_TEXT[status.tone],
        className,
      )}
    >
      <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", TONE_DOT[status.tone])} aria-hidden="true" />
      {status.label}
    </span>
  );
}

/** Thanh 4 đoạn dưới nhãn trạng thái — đã qua bao nhiêu bước của DIGITIZE_TRACK. */
export function DigitizeTrackBar({ step }: { step: number }) {
  return (
    <div
      className="mt-[7px] flex w-[92px] gap-[3px]"
      role="img"
      aria-label={`Đã xong ${Math.min(step, DIGITIZE_TRACK.length)}/${DIGITIZE_TRACK.length} bước`}
    >
      {DIGITIZE_TRACK.map((label, i) => (
        <i key={label} className={cn("h-[3px] flex-1 rounded-sm", i < step ? "bg-primary" : "bg-border")} />
      ))}
    </div>
  );
}

/** Cột "Bước tiếp theo": ai đang phải làm + một câu. */
export function DigitizeNextCell({ status, line }: { status: DigitizeStatus; line: string }) {
  const who = digitizeWhoLabel(status.who);
  const mine = status.who === "owner";
  return (
    <div className={cn("text-[13px] leading-snug", mine ? "font-semibold text-foreground" : "text-muted-foreground")}>
      {who && (
        <span
          className={cn(
            "mb-px flex items-center gap-1.5 text-[11.5px] font-semibold",
            status.tone === "err" ? "text-destructive" : mine ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {mine && <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[status.tone])} aria-hidden="true" />}
          {who}
        </span>
      )}
      {line}
    </div>
  );
}
