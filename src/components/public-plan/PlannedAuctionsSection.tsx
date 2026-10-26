import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Info, Loader2, MapPinned } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  usePublicPlanItems,
  usePublicPlanProvinces,
  usePublicPlanUnits,
} from "@/hooks/usePublicPlanItems";
import { groupByQuarter } from "@/lib/publicPlanItems";
import { PlannedAuctionCard } from "./PlannedAuctionCard";

const ALL_UNITS = "all";

const Empty = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-2xl border border-border bg-card py-12 text-center">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
      <CalendarRange className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    <p className="mx-auto mt-1 max-w-md px-4 text-sm text-muted-foreground">{description}</p>
  </div>
);

/**
 * "Sắp đấu giá theo kế hoạch" — mặt CÔNG KHAI của kế hoạch đấu giá
 * (Phase 10 của docs/owner-auction-planning-plan.md).
 *
 * Nguồn duy nhất là ba RPC cấp cho `anon`: tỉnh nào đang công khai → xã nào →
 * danh mục tài sản. Trang KHÔNG đọc bảng `auction_plan_*` (và không có quyền).
 * Chỉ danh mục của kế hoạch ĐÃ DUYỆT + ĐÃ BẬT công khai đi tới được đây, thời
 * gian chỉ tới mức QUÝ, giá chỉ hiện khi đơn vị bật công tắc riêng.
 *
 * Bộ chọn tỉnh chỉ liệt kê tỉnh THẬT SỰ có danh mục công khai (thay vì cả 34
 * tỉnh mà hầu hết trống) — xem `get_public_plan_provinces`.
 */
export function PlannedAuctionsSection() {
  const { data: provinces = [], isLoading: provincesLoading } = usePublicPlanProvinces();
  const [provinceCode, setProvinceCode] = useState<string | null>(null);
  const [unitCode, setUnitCode] = useState<string>(ALL_UNITS);

  // Mở ra là đã có dữ liệu: chọn sẵn tỉnh đầu tiên đang công khai.
  useEffect(() => {
    if (!provinceCode && provinces.length > 0) setProvinceCode(provinces[0].code);
  }, [provinceCode, provinces]);

  const { data: units = [] } = usePublicPlanUnits(provinceCode);
  const { data: items = [], isLoading } = usePublicPlanItems(provinceCode);

  const visible = useMemo(
    () => (unitCode === ALL_UNITS ? items : items.filter((i) => i.communeCode === unitCode)),
    [items, unitCode],
  );
  const groups = useMemo(() => groupByQuarter(visible), [visible]);
  const province = provinces.find((p) => p.code === provinceCode) ?? null;

  if (provincesLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Đang tải danh mục dự kiến…</p>
      </div>
    );
  }

  if (provinces.length === 0) {
    return (
      <Empty
        title="Chưa có địa phương nào công khai danh mục"
        description="Các xã, phường đang lập kế hoạch đấu giá quyền sử dụng đất. Khi kế hoạch được duyệt và công khai, danh mục dự kiến sẽ xuất hiện tại đây."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <MapPinned className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Danh mục dự kiến đã công khai</p>
            <p className="text-xl font-bold leading-tight text-foreground">
              {visible.length.toLocaleString("en-US")}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                tài sản · {units.length} xã/phường
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={provinceCode ?? undefined} onValueChange={(v) => { setProvinceCode(v); setUnitCode(ALL_UNITS); }}>
            <SelectTrigger className="h-9 w-[220px]" aria-label="Tỉnh / thành phố">
              <SelectValue placeholder="Chọn tỉnh / thành phố" />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name} ({p.itemCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={unitCode} onValueChange={setUnitCode}>
            <SelectTrigger className="h-9 w-[220px]" aria-label="Xã / phường">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_UNITS}>Tất cả xã/phường</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.code} value={u.code}>
                  {u.name} ({u.itemCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-2xl border border-primary/50 bg-card p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
        <span>
          Đây là danh mục <span className="font-medium text-foreground">dự kiến</span> theo kế hoạch đấu giá đã được
          phê duyệt của {province?.name ?? "địa phương"}. Thời gian chỉ tới mức quý và có thể thay đổi; giá khởi điểm
          chính thức chỉ có trong thông báo đấu giá. Bấm{" "}
          <span className="font-medium text-foreground">Theo dõi</span> để được nhắc khi tài sản có phiên đấu giá.
        </span>
      </p>

      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Đang tải danh mục dự kiến…</p>
        </div>
      ) : groups.length === 0 ? (
        <Empty
          title="Chưa có tài sản nào trong danh mục này"
          description="Hãy chọn địa phương khác, hoặc quay lại sau khi kế hoạch được cập nhật."
        />
      ) : (
        groups.map((group) => (
          <section key={group.quarter ?? "unknown"} className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <h2 className="font-semibold text-foreground">{group.label}</h2>
              <span className="text-sm text-muted-foreground">· {group.items.length} tài sản</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((item) => (
                <PlannedAuctionCard key={item.code} item={item} scopeCode={provinceCode} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
