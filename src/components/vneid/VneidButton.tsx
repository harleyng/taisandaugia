import { ShieldCheck } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Nút "Lấy thông tin từ VNeID" — dùng ở form mua hồ sơ và trang hồ sơ cá nhân. */
export function VneidButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn("gap-2 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary", className)}
      {...props}
    >
      <ShieldCheck className="h-4 w-4" />
      {children ?? (
        <span>
          Lấy thông tin từ <span className="font-extrabold tracking-tight">VNeID</span>
        </span>
      )}
    </Button>
  );
}

/** Nhãn nhỏ "Đã xác thực VNeID" cạnh tên người đăng ký. */
export function VneidVerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary",
        className,
      )}
    >
      <ShieldCheck className="h-3 w-3" />
      VNeID
    </span>
  );
}
