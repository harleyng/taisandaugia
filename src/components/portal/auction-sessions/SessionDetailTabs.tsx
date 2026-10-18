import { Fragment } from "react";
import { cn } from "@/lib/utils";

export type SessionTab = "thong-tin" | "tai-san" | "tai-lieu" | "ho-so" | "diem-danh" | "tiep-thi" | "dieu-hanh";

/** Nhóm chuẩn bị phiên | nhóm vận hành, ngăn bằng vạch dọc (design `.dtabs`). */
const PREP: [SessionTab, string][] = [
  ["thong-tin", "Thông tin"],
  ["tai-san", "Tài sản"],
  ["tai-lieu", "Tài liệu"],
];
const OPS: [SessionTab, string][] = [
  ["ho-so", "Hồ sơ tham gia"],
  ["diem-danh", "Điểm danh"],
  ["tiep-thi", "Tiếp thị"],
  ["dieu-hanh", "Điều hành"],
];

export interface TabCount {
  text: string;
  /** Tô vàng — có việc chờ xử lý. */
  attention?: boolean;
}

interface Props {
  tab: SessionTab;
  /** Tab vận hành được hiện (quyền + hình thức + vòng đời do trang quyết). */
  visible: Set<SessionTab>;
  counts: Partial<Record<SessionTab, TabCount>>;
  onSelect: (tab: SessionTab) => void;
}

export function SessionDetailTabs({ tab, visible, counts, onSelect }: Props) {
  const button = ([key, label]: [SessionTab, string]) => {
    const count = counts[key];
    const on = key === tab;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={on}
        onClick={() => onSelect(key)}
        className={cn(
          "flex items-center gap-1.5 whitespace-nowrap px-2.5 pb-[11px] pt-[9px] text-[13.5px] font-semibold transition-colors",
          on
            ? "text-foreground shadow-[inset_0_-2px_0_hsl(var(--foreground))]"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        {count && (
          <span
            className={cn(
              "min-w-[18px] rounded-full px-[5px] text-[11px] font-semibold tabular-nums",
              count.attention
                ? "bg-[hsl(var(--tier-warn-bg))] text-[hsl(var(--tier-warn-strong))]"
                : "bg-card text-muted-foreground",
            )}
          >
            {count.text}
          </span>
        )}
      </button>
    );
  };

  const ops = OPS.filter(([key]) => visible.has(key));
  return (
    <div role="tablist" className="flex items-center gap-0.5 overflow-x-auto overflow-y-hidden border-b">
      {PREP.map(button)}
      {ops.length > 0 && (
        <Fragment>
          <span aria-hidden className="mx-2.5 h-[18px] w-px shrink-0 bg-border" />
          {ops.map(button)}
        </Fragment>
      )}
    </div>
  );
}
