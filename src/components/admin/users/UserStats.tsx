import { Users, UserCheck, CalendarPlus, CalendarClock, Coins, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { groupNumber } from "@/lib/advertising/slug";
import type { AdminUserStats } from "@/types/adminUser";

interface Tile {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
}

export function UserStats({ stats, isLoading }: { stats?: AdminUserStats; isLoading: boolean }) {
  const tiles: Tile[] = [
    { label: "Tổng người dùng", value: groupNumber(stats?.total ?? 0), icon: Users, color: "text-primary" },
    { label: "Đang hoạt động", value: groupNumber(stats?.active ?? 0), icon: UserCheck, color: "text-success" },
    { label: "Mới trong tuần", value: groupNumber(stats?.newThisWeek ?? 0), icon: CalendarPlus, color: "text-accent" },
    { label: "Mới trong tháng", value: groupNumber(stats?.newThisMonth ?? 0), icon: CalendarClock, color: "text-accent" },
    { label: "Credit nạp trong tháng", value: `${groupNumber(stats?.topupThisMonth ?? 0)} CR`, icon: Coins, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <t.icon className={`h-4 w-4 ${t.color}`} />
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <span className="text-2xl font-bold text-foreground">{t.value}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{t.label}</p>
        </div>
      ))}
    </div>
  );
}
