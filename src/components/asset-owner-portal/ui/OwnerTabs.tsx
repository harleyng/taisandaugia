import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { LucideIcon } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Thanh tab DUY NHẤT của Trạm Điều Hành (theo thiết kế "Số hoá tài sản"): chữ + số
 * đếm, gạch chân xanh ở tab đang chọn, viền dưới mảnh chạy hết chiều ngang. Dùng cho
 * cả tab lọc danh sách lẫn tab chia nội dung — không trang nào tự vẽ tab riêng.
 *
 * Dựng trên Radix Tabs để có sẵn điều hướng bàn phím (mũi tên) và aria.
 *
 * Đường kẻ dưới là bóng inset chứ không phải border: danh sách cuộn ngang
 * (overflow-x-auto) thì cắt cả chiều dọc, gạch chân kéo -mb-px đè lên border sẽ
 * mất nửa. Bóng inset nằm TRONG khung nên gạch chân 2px của tab vẽ đè lên được.
 */
export const OwnerTabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex min-w-0 items-end gap-0.5 overflow-x-auto shadow-[inset_0_-1px_0_hsl(var(--border))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      className,
    )}
    {...props}
  />
));
OwnerTabsList.displayName = "OwnerTabsList";

interface OwnerTabsTriggerProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Số mục của tab; bỏ trống = không hiện viên số. */
  count?: number;
  /** Tab "việc của bạn": số đếm tô vàng khi > 0. */
  attention?: boolean;
  icon?: LucideIcon;
}

export const OwnerTabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, OwnerTabsTriggerProps>(
  ({ className, count, attention, icon: Icon, children, ...props }, ref) => {
    const hl = !!attention && !!count;
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
          "group inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-foreground",
          className,
        )}
        {...props}
      >
        {Icon && <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
        {children}
        {count !== undefined && (
          <span
            className={cn(
              "rounded-full px-[7px] text-[11.5px] font-semibold leading-[18px] tabular-nums",
              hl
                ? "bg-warning/20 text-foreground"
                : "bg-foreground/[0.06] text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary",
            )}
          >
            {count.toLocaleString("en-US")}
          </span>
        )}
      </TabsPrimitive.Trigger>
    );
  },
);
OwnerTabsTrigger.displayName = "OwnerTabsTrigger";

export interface OwnerTabItem<K extends string> {
  value: K;
  label: ReactNode;
  count?: number;
  attention?: boolean;
  icon?: LucideIcon;
}

interface OwnerTabBarProps<K extends string> {
  value: K;
  onValueChange: (value: K) => void;
  items: OwnerTabItem<K>[];
  "aria-label": string;
  className?: string;
  listClassName?: string;
}

/**
 * Thanh tab lọc (không có panel riêng): danh sách bên dưới tự lọc theo `value`.
 * Trang có nội dung theo tab thì dùng `Tabs` + `OwnerTabsList` + `OwnerTabsTrigger`.
 */
export function OwnerTabBar<K extends string>({
  value,
  onValueChange,
  items,
  className,
  listClassName,
  ...rest
}: OwnerTabBarProps<K>) {
  return (
    <Tabs value={value} onValueChange={(v) => v && onValueChange(v as K)} className={cn("min-w-0", className)}>
      <OwnerTabsList aria-label={rest["aria-label"]} className={listClassName}>
        {items.map((it) => (
          // Không có panel ⇒ bỏ aria-controls Radix tự trỏ tới một TabsContent không tồn tại.
          <OwnerTabsTrigger
            key={it.value}
            value={it.value}
            count={it.count}
            attention={it.attention}
            icon={it.icon}
            aria-controls={undefined}
          >
            {it.label}
          </OwnerTabsTrigger>
        ))}
      </OwnerTabsList>
    </Tabs>
  );
}
