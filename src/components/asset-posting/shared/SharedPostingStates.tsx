import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Khung chờ — cùng bố cục 2 cột của trang hồ sơ. */
export function SharedPostingLoading() {
  return (
    <div className="mx-auto grid max-w-[1160px] grid-cols-1 gap-6 p-3 sm:grid-cols-[minmax(0,1fr)_360px] sm:p-5">
      <div className="flex flex-col gap-3.5">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-[30px] w-4/5" />
        <Skeleton className="h-[84px] rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <Skeleton className="hidden h-80 rounded-2xl sm:block" />
    </div>
  );
}

/** Link không mở được / lỗi tải — thẻ giữa trang, một nút hành động. */
export function SharedPostingEmpty({
  icon: Icon,
  tone = "muted",
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  tone?: "muted" | "error";
  title: string;
  description?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="mx-auto my-16 max-w-[520px] px-4">
      <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-card px-7 py-9 text-center shadow-card">
        <span
          className={cn(
            "mb-1.5 grid h-14 w-14 place-items-center rounded-full",
            tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-[26px] w-[26px]" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <h2 className="text-[19px] font-bold text-foreground">{title}</h2>
        {description && <p className="max-w-[400px] text-[14.5px] text-muted-foreground">{description}</p>}
        <div className="mt-2.5">{action}</div>
      </div>
    </div>
  );
}
