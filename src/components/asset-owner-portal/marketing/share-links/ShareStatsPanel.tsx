import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import {
  SHARE_DEVICES,
  SHARE_PERIODS,
  formatCount,
  formatRate,
  type ShareDeviceFilter,
  type SharePeriod,
  type ShareSeries,
} from "@/lib/shareLinks/series";
import { ShareLinkTrafficChart } from "./ShareLinkTrafficChart";

interface ShareStatsPanelProps {
  series: ShareSeries | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  period: SharePeriod;
  device: ShareDeviceFilter;
  onPeriod: (v: SharePeriod) => void;
  onDevice: (v: ShareDeviceFilter) => void;
  /** Tin trên sàn: nút theo dõi là "Lưu tài sản". */
  followLabel?: string;
  /** "Từ khi tạo link" / "Từ khi duyệt" — nhãn lựa chọn khoảng dài nhất. */
  allLabel?: string;
}

function Metric({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={strong ? "mt-1 text-2xl font-semibold tabular-nums text-foreground" : "mt-1 text-lg font-semibold tabular-nums text-foreground"}>
        {value}
      </p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Bộ lọc khoảng ngày + thiết bị (một hàng), dải số tổng của khoảng và biểu đồ theo ngày.
 * Thành viên đơn vị mở link không được tính (server).
 */
export function ShareStatsPanel({
  series,
  isLoading,
  isError,
  onRetry,
  period,
  device,
  onPeriod,
  onDevice,
  followLabel = "Theo dõi / lưu",
  allLabel,
}: ShareStatsPanelProps) {
  const t = series?.totals;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Thành viên đơn vị mở link không được tính.</p>
        <div className="flex flex-wrap gap-2">
          <OwnerFilterSelect label="Thời gian" value={period} onValueChange={(v) => onPeriod(v as SharePeriod)}>
            {SHARE_PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.value === "all" && allLabel ? allLabel : p.label}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
          <OwnerFilterSelect label="Thiết bị" value={device} onValueChange={(v) => onDevice(v as ShareDeviceFilter)}>
            {SHARE_DEVICES.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </OwnerFilterSelect>
        </div>
      </div>

      {isError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-destructive/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" strokeWidth={1.5} />
            Chưa tải được số liệu.
          </span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      ) : isLoading || !series || !t ? (
        <>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-muted/50 px-4 py-4 sm:grid-cols-4 lg:grid-cols-7">
            <Metric strong label="Lượt xem" value={formatCount(t.views)} />
            <Metric strong label="Người xem" value={formatCount(t.viewers)} hint="trình duyệt khác nhau" />
            <Metric strong label="Bấm “Mua hồ sơ”" value={formatCount(t.dossier)} hint={`${formatCount(t.dossierPeople)} người`} />
            <Metric strong label="Tỷ lệ chuyển đổi" value={formatRate(t.conversion)} hint="người bấm / người xem" />
            <Metric label={followLabel} value={formatCount(t.follow)} />
            <Metric label="Tải PDF" value={formatCount(t.pdf)} />
            <Metric label="Bấm gọi" value={formatCount(t.call)} />
          </div>
          <ShareLinkTrafficChart series={series} />
        </>
      )}
    </div>
  );
}
