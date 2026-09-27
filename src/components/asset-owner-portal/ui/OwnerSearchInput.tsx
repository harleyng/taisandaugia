import type { ComponentPropsWithoutRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface OwnerSearchInputProps
  extends Omit<ComponentPropsWithoutRef<typeof Input>, "type" | "value" | "onChange" | "className"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Tên cho trình đọc màn hình — placeholder không thay được nhãn. */
  "aria-label": string;
  /** Lớp của khung ngoài (độ rộng); ô nhập bên trong luôn cùng một kiểu. */
  className?: string;
}

/**
 * Ô tìm kiếm DUY NHẤT của Trạm Điều Hành: icon kính lúp bên trái, cao 36px, nền trắng.
 * Nằm thẳng trên nền xám thì quy tắc `.owner-canvas` bỏ viền + đổ bóng như thẻ; nằm
 * trong thẻ thì giữ viền mảnh — cùng một component cho cả hai chỗ.
 */
export function OwnerSearchInput({ value, onValueChange, className, ...props }: OwnerSearchInputProps) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="h-9 bg-card pl-9 text-[13.5px]"
        {...props}
      />
    </div>
  );
}
