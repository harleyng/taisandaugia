import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShareCard } from "./sharedParts";

const isLong = (v: string) => v.length > 28;

/** Mô tả (gập 5 dòng, "Xem thêm") + toàn bộ thông số đã khai — cùng luật nhãn với bản in A4 (specRows). */
export function SharedSpecs({ description, specs }: { description: string | null; specs: { k: string; v: string }[] }) {
  const desc = description?.trim();
  // Dòng giá trị dài chiếm trọn hàng ⇒ dồn xuống cuối để lưới 2 cột không bị lỗ.
  const rows = [...specs.filter((s) => !isLong(s.v)), ...specs.filter((s) => isLong(s.v))];
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  // Chỉ hiện "Xem thêm" khi đoạn mô tả thật sự bị cắt ở 5 dòng.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !expanded) setClipped(el.scrollHeight > el.clientHeight + 1);
  }, [desc, expanded]);

  if (!desc && specs.length === 0) return null;

  return (
    <ShareCard title="Mô tả & thông số" icon={ListChecks}>
      {desc && (
        <>
          <p
            ref={ref}
            className={cn("whitespace-pre-line text-[15px] leading-[1.7] text-foreground/85", !expanded && "line-clamp-5")}
          >
            {desc}
          </p>
          {(clipped || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              {expanded ? "Thu gọn" : "Xem thêm"}
              <ChevronDown
                className={cn("h-[15px] w-[15px] transition-transform", expanded && "rotate-180")}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>
          )}
        </>
      )}
      {specs.length > 0 && (
        <dl className={cn("grid grid-cols-1 border-t border-border sm:grid-cols-2 sm:gap-x-7", desc && "mt-[18px]")}>
          {rows.map((s) => (
            <div
              key={s.k}
              className={cn(
                "flex justify-between gap-3 border-b border-border py-[11px] text-sm",
                isLong(s.v) && "sm:col-span-2",
              )}
            >
              <dt className="text-muted-foreground">{s.k}</dt>
              <dd className="text-right font-semibold tabular-nums text-foreground">{s.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </ShareCard>
  );
}
