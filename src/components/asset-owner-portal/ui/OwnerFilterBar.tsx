import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OwnerFilterBarProps {
  /** Thanh tab (thường là `OwnerTabBar`) — chiếm phần còn lại của hàng. */
  tabs?: ReactNode;
  /** Ô tìm + bộ lọc thả xuống, dồn về bên phải. */
  children?: ReactNode;
  className?: string;
}

/**
 * Hàng công cụ của một danh sách: tab bên trái, tìm + lọc bên phải. Màn hẹp thì tab
 * chiếm trọn một dòng và ô tìm xuống dòng dưới, vẫn dạt phải.
 */
export function OwnerFilterBar({ tabs, children, className }: OwnerFilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      {tabs && <div className="min-w-0 basis-full xl:basis-0 xl:flex-1">{tabs}</div>}
      {children && <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">{children}</div>}
    </div>
  );
}
