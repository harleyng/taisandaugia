import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { KgLogEntry } from "@/lib/consignment/ownerConsignmentView";
import { KgCard } from "./KgCard";

/** Hiện sẵn bấy nhiêu mốc; còn lại gập sau "Xem thêm". */
const VISIBLE = 8;

/** Nhật ký luồng ký gửi, mới nhất trên cùng (mốc đầu tô xanh). */
export function ActivityCard({ entries }: { entries: KgLogEntry[] }) {
  const [all, setAll] = useState(false);
  if (entries.length === 0) return null;
  const shown = all ? entries : entries.slice(0, VISIBLE);

  return (
    <KgCard title="Hoạt động">
      <ol className="relative">
        {shown.map((e, i) => (
          <li
            key={`${e.at}-${i}`}
            className={cn(
              "relative grid grid-cols-[12px_42px_minmax(0,1fr)] gap-2.5 pb-3.5 text-[13px] last:pb-0",
              i < shown.length - 1 && "before:absolute before:bottom-0 before:left-[5px] before:top-3 before:w-px before:bg-border",
            )}
          >
            <i
              aria-hidden="true"
              className={cn(
                "mt-1 h-[11px] w-[11px] rounded-full border-2",
                i === 0 ? "border-primary bg-primary" : "border-input bg-card",
              )}
            />
            <time dateTime={e.at} className="pt-px text-xs tabular-nums text-muted-foreground">
              {format(new Date(e.at), "dd/MM")}
            </time>
            <span className={cn("leading-[1.45]", i === 0 ? "font-medium text-foreground" : "text-foreground/70")}>{e.text}</span>
          </li>
        ))}
      </ol>
      {entries.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 text-[13px] font-semibold text-primary hover:underline"
        >
          {all ? "Thu gọn" : `Xem thêm ${entries.length - VISIBLE} hoạt động`}
        </button>
      )}
    </KgCard>
  );
}
