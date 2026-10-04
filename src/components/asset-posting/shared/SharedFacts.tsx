import { Building2, CalendarDays, FileText, Layers, Ruler, Tag, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlightFacts, splitUnit } from "@/lib/postingShare/view";

/** Biểu tượng theo nhãn thông số (nhãn do registry delta của từng nhóm tài sản đặt). */
function iconOf(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes("sàn") || l.includes("xây dựng")) return Building2;
  if (l.includes("diện tích") || l.includes("chiều") || l.includes("mặt tiền")) return Ruler;
  if (l.includes("tầng")) return Layers;
  if (l.includes("giấy") || l.includes("pháp lý") || l.includes("sổ")) return FileText;
  if (l.includes("năm")) return CalendarDays;
  return Tag;
}

const COLS: Record<number, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

/** Dải 4 thông số nổi bật ngay dưới tiêu đề — lấy từ cùng danh sách với thẻ "Mô tả & thông số". */
export function SharedFacts({ specs }: { specs: { k: string; v: string }[] }) {
  const facts = highlightFacts(specs);
  if (facts.length === 0) return null;

  return (
    <dl className={cn("grid grid-cols-2 rounded-2xl bg-card shadow-card", COLS[facts.length])}>
      {facts.map((f, i) => {
        const Icon = iconOf(f.k);
        const { value, unit } = splitUnit(f.v);
        return (
          <div
            key={f.k}
            className={cn(
              "min-w-0 px-[18px] py-4",
              i % 2 === 1 && "border-l border-border",
              i > 0 && "sm:border-l",
              i >= 2 && "border-t border-border sm:border-t-0",
              facts.length === 1 && "col-span-2 sm:col-span-1",
            )}
          >
            <dt className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
              <span className="truncate">{f.k}</span>
            </dt>
            <dd className="mt-1 break-words text-[17px] font-semibold leading-snug tabular-nums text-foreground">
              {value}
              {unit && <small className="ml-1 text-[13px] font-medium text-muted-foreground">{unit}</small>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
