import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OWNER_TONE_DOT, OWNER_TONE_TEXT, type OwnerStatusTone } from "@/lib/ownerStatusTone";
import { KG_TRACK, kgWhoLabel, type KgStatus } from "@/lib/consignment/ownerConsignmentView";

/** "● Từ chối · 22/09" — chấm màu + chữ theo sắc thái. */
export function ToneLabel({ tone, children, className }: { tone: OwnerStatusTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-start gap-[7px] text-[12.5px] font-semibold leading-[1.35]",
        OWNER_TONE_TEXT[tone],
        className,
      )}
    >
      <span className={cn("mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full", OWNER_TONE_DOT[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

/** "● Chờ bạn chọn báo giá" — nhãn giai đoạn ký gửi. */
export function KgStatusLabel({ status, className }: { status: KgStatus; className?: string }) {
  return (
    <ToneLabel tone={status.tone} className={className}>
      {status.label}
    </ToneLabel>
  );
}

/** Thanh 3 đoạn dưới nhãn — đã qua bao nhiêu bước của KG_TRACK. */
export function KgTrackBar({ step }: { step: number }) {
  return (
    <div
      className="mt-[7px] flex w-[92px] gap-[3px]"
      role="img"
      aria-label={`Đã xong ${Math.min(step, KG_TRACK.length)}/${KG_TRACK.length} bước`}
    >
      {KG_TRACK.map((label, i) => (
        <i key={label} className={cn("h-[3px] flex-1 rounded-sm", i < step ? "bg-primary" : "bg-border")} />
      ))}
    </div>
  );
}

/** Cột "Bước tiếp theo": ai đang phải làm + một câu. */
export function KgNextCell({ status, line }: { status: KgStatus; line: string }) {
  const who = kgWhoLabel(status);
  const err = status.tone === "err";
  return (
    <div className={cn("text-[13px] leading-snug", status.mine ? "font-semibold text-foreground" : "text-foreground/70")}>
      {who && (
        <span
          className={cn(
            "mb-px flex items-center gap-1.5 text-[11.5px] font-semibold",
            err ? "text-destructive" : status.mine ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {status.mine && (
            <span className={cn("h-1.5 w-1.5 rounded-full", OWNER_TONE_DOT[status.tone])} aria-hidden="true" />
          )}
          {who}
        </span>
      )}
      {line}
    </div>
  );
}
