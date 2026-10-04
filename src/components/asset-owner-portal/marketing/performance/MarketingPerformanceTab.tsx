import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, BarChart3, Building2, Filter, Layers, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { StatTile } from "@/components/asset-owner-portal/ui/StatTile";
import { useOwnerMarketingFunnel } from "@/hooks/useOwnerMarketingFunnel";
import { todayIso } from "@/lib/ownerOutcomeReport";
import {
  FUNNEL_PERIODS,
  FUNNEL_PERIOD_LABEL,
  funnelStages,
  isFunnelEmpty,
  priceRatioPct,
  resolveFunnelPeriod,
  UNATTRIBUTED_HINT,
  type FunnelPeriod,
} from "@/lib/ownerMarketing/funnel";
import { ownerMarketingTabHref } from "@/lib/ownerMarketing/routes";
import { FunnelBars } from "./FunnelBars";
import { FunnelAssetTable, FunnelChannelTable, FunnelSourceTable } from "./FunnelBreakdownTables";

export const ASSET_FILTER_ALL = "tat-ca";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MarketingPerformanceTabProps {
  period: FunnelPeriod;
  /** listings.id hoặc ASSET_FILTER_ALL. */
  asset: string;
  onFilter: (key: "ky" | "tai-san", value: string) => void;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const day = (iso: string) => iso.split("-").reverse().join("/");

/**
 * "Hiệu quả quảng cáo" (Phase M5; trước là tab "Hiệu quả" của Truyền thông): phễu Gửi → … → Kết quả cho cả đơn vị, hoặc lọc một tài sản
 * (thay cho tab "Truyền thông" của tài sản — lối vào từ danh sách Tài sản). Số do server tính
 * (owner_mkt_funnel) — cùng kỳ thì khớp phần "Hiệu quả truyền thông" của báo cáo định kỳ.
 */
export function MarketingPerformanceTab({ period, asset, onFilter }: MarketingPerformanceTabProps) {
  const navigate = useNavigate();
  const { from, to } = useMemo(() => resolveFunnelPeriod(period, todayIso()), [period]);
  // Chỉ nhận id dạng UUID — link cũ / gõ tay sai rơi về "Tất cả" thay vì lỗi RPC.
  const listingId = UUID_RE.test(asset) ? asset : null;
  const all = useOwnerMarketingFunnel(from, to, null);
  const one = useOwnerMarketingFunnel(from, to, listingId);
  const shown = listingId ? one : all;
  const f = shown.data;

  // Danh sách chọn tài sản lấy từ phễu cả đơn vị cùng kỳ; tài sản đang lọc luôn có mặt.
  const assetOptions = useMemo(() => {
    const rows = (all.data?.byAsset ?? []).flatMap((a) => (a.assetId ? [{ id: a.assetId, title: a.title }] : []));
    if (listingId && !rows.some((r) => r.id === listingId)) {
      rows.unshift({ id: listingId, title: one.data?.byAsset[0]?.title ?? "Tài sản đã chọn" });
    }
    return rows;
  }, [all.data, one.data, listingId]);

  const filters = (
    <OwnerFilterBar
      tabs={
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {day(from)} – {day(to)}
          </span>
          {" · ghi nhận nguồn theo lần bấm link gần nhất trong 30 ngày"}
        </p>
      }
    >
      <OwnerFilterSelect label="Kỳ" value={period} onValueChange={(v) => onFilter("ky", v)}>
        {FUNNEL_PERIODS.map((p) => (
          <SelectItem key={p} value={p}>
            {FUNNEL_PERIOD_LABEL[p]}
          </SelectItem>
        ))}
      </OwnerFilterSelect>
      <OwnerFilterSelect label="Tài sản" value={listingId ?? ASSET_FILTER_ALL} onValueChange={(v) => onFilter("tai-san", v)} className="sm:max-w-[18rem]">
        <SelectItem value={ASSET_FILTER_ALL}>Tất cả</SelectItem>
        {assetOptions.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.title}
          </SelectItem>
        ))}
      </OwnerFilterSelect>
    </OwnerFilterBar>
  );

  if (shown.isLoading) {
    return (
      <div className="space-y-4">
        {filters}
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (shown.isError || !f) {
    return (
      <div className="space-y-4">
        {filters}
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={AlertCircle}
            tone="destructive"
            title="Không tải được hiệu quả truyền thông"
            description={shown.error instanceof Error ? shown.error.message : "Vui lòng thử lại."}
            action={
              <Button variant="outline" onClick={() => shown.refetch()}>
                Thử lại
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (f.totals.assets === 0) {
    return (
      <div className="space-y-4">
        {filters}
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={BarChart3}
            title={listingId ? "Tài sản này chưa có hoạt động truyền thông" : "Chưa có hoạt động truyền thông"}
            description="Tạo link theo dõi cho kênh của đơn vị, chạy chiến dịch, hoặc giao việc cho sàn — phễu từ lượt bấm tới lượt đăng ký tham gia sẽ hiện ở đây."
            action={
              <Button variant="outline" className="gap-1.5" onClick={() => navigate(ownerMarketingTabHref("link-theo-doi"))}>
                <Link2 className="h-4 w-4" strokeWidth={1.5} />
                Tạo link theo dõi
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const t = f.totals;
  const unknownRegs = f.unattributed.registrations;
  const asOne = listingId ? f.byAsset[0] : null;

  return (
    <div className="space-y-4">
      {filters}

      <section className="space-y-4 rounded-2xl bg-card p-4 shadow-card sm:p-5">
        <HeroFigure
          label={asOne ? `Đăng ký tham gia nhờ truyền thông · ${asOne.title}` : "Đăng ký tham gia nhờ truyền thông"}
          value={fmt(t.registrations)}
          unit="hồ sơ"
          context={
            <span title={UNATTRIBUTED_HINT}>
              {unknownRegs > 0 ? `+${fmt(unknownRegs)} đăng ký không xác định nguồn · ` : ""}
              {listingId ? `${fmt(t.links)} link · ${fmt(t.orders)} đơn sàn làm` : `${fmt(t.assets)} tài sản đang truyền thông`}
            </span>
          }
        />
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Lượt bấm" value={fmt(t.clicks)} context="Link theo dõi + email, banner của sàn" />
        <StatTile label="Người xem tài sản" value={fmt(t.visitors)} context="Trình duyệt khác nhau, theo link" />
        <StatTile label="Lượt lưu" value={fmt(t.saves)} context={f.unattributed.saves ? `+${fmt(f.unattributed.saves)} không xác định nguồn` : "Tới từ link theo dõi"} />
        <StatTile
          label="Đấu thành trong kỳ"
          value={`${fmt(t.sold)}/${fmt(t.outcomes)}`}
          context={t.outcomes ? `${fmt(t.participants)} người tham gia` : "Chưa có phiên có kết quả"}
        />
      </div>

      <SectionCard title="Phễu truyền thông" icon={Filter}>
        {isFunnelEmpty(f) ? (
          <EmptyState compact icon={Filter} tone="muted" title="Kỳ này chưa có lượt nào" description="Thử chọn kỳ dài hơn." />
        ) : (
          <FunnelBars stages={funnelStages(t)} priceRatio={priceRatioPct(t)} />
        )}
      </SectionCard>

      <SectionCard title="Theo nguồn và kênh" icon={Layers}>
        <div className="space-y-5">
          <FunnelSourceTable funnel={f} variant="screen" />
          <FunnelChannelTable funnel={f} variant="screen" />
          <p className="text-xs text-muted-foreground">{UNATTRIBUTED_HINT}</p>
        </div>
      </SectionCard>

      {!listingId && (
        <SectionCard title="Theo tài sản" icon={Building2} count={f.byAsset.length}>
          <FunnelAssetTable funnel={f} variant="screen" onSelect={(id) => onFilter("tai-san", id)} />
        </SectionCard>
      )}
      {listingId && (
        <SectionCard title="Kết quả của tài sản" icon={Building2}>
          <FunnelAssetTable funnel={f} variant="screen" />
        </SectionCard>
      )}
    </div>
  );
}
