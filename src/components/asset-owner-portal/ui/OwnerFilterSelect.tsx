import type { ReactNode } from "react";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface OwnerFilterSelectProps {
  /** Nhãn mờ đứng trước giá trị ("Kỳ", "Đơn vị", "Chi nhánh") — cũng là aria-label. */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Các `SelectItem` / `SelectGroup`. */
  children: ReactNode;
  className?: string;
}

/**
 * Bộ lọc thả xuống DUY NHẤT của Trạm Điều Hành: "nhãn mờ + giá trị đậm", cao 36px,
 * nền trắng — cùng khuôn với `OwnerSearchInput` để một hàng lọc đọc như một khối.
 * Radix Select bắn onValueChange("") khi danh sách lựa chọn đổi ⇒ bỏ qua giá trị rỗng.
 */
export function OwnerFilterSelect({ label, value, onValueChange, children, className }: OwnerFilterSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => v && onValueChange(v)}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-9 w-full gap-2 bg-card text-[13.5px] sm:w-auto sm:min-w-[10rem] [&>span]:line-clamp-none",
          className,
        )}
      >
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
