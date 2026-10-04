import { Megaphone } from "lucide-react";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { FunnelBars } from "@/components/asset-owner-portal/marketing/performance/FunnelBars";
import {
  FunnelAssetTable,
  FunnelChannelTable,
  FunnelSourceTable,
} from "@/components/asset-owner-portal/marketing/performance/FunnelBreakdownTables";
import { funnelStages, isFunnelEmpty, priceRatioPct, UNATTRIBUTED_HINT } from "@/lib/ownerMarketing/funnel";
import type { ReportPayload } from "@/lib/ownerPeriodicReport";
import type { ReportVariant } from "./ReportTable";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Phần 6 — Hiệu quả truyền thông của kỳ (Phase M5). Cùng hàm server với tab "Hiệu quả" của
 * module Truyền thông ⇒ cùng kỳ thì cùng số. Chỉ số đếm theo kênh / tài sản, không dữ liệu cá nhân.
 */
export function ReportMarketingSection({ payload, variant }: { payload: ReportPayload; variant: ReportVariant }) {
  const mk = payload.marketing;
  const print = variant !== "screen";

  let body;
  if (!mk) {
    body = (
      <EmptyState compact icon={Megaphone} tone="muted" title="Báo cáo này được chốt trước khi có phần Hiệu quả truyền thông." />
    );
  } else if (isFunnelEmpty(mk)) {
    body = <EmptyState compact icon={Megaphone} tone="muted" title="Kỳ này không có hoạt động truyền thông." />;
  } else {
    const t = mk.totals;
    body = (
      <div className="space-y-5">
        <p className="text-sm text-foreground">
          <span className="font-semibold tabular-nums">{fmt(t.registrations)}</span> đăng ký tham gia tới từ link theo dõi
          {mk.unattributed.registrations > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · thêm {fmt(mk.unattributed.registrations)} đăng ký không xác định nguồn
            </span>
          )}{" "}
          <span className="text-muted-foreground">· {fmt(t.assets)} tài sản đang truyền thông</span>
        </p>
        <div className="break-inside-avoid">
          <FunnelBars stages={funnelStages(t)} priceRatio={priceRatioPct(t)} print={print} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Theo nguồn và kênh</h3>
          <FunnelSourceTable funnel={mk} variant={variant} />
          <FunnelChannelTable funnel={mk} variant={variant} />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Theo tài sản</h3>
          <FunnelAssetTable funnel={mk} variant={variant} />
        </div>
        <p className="text-xs text-muted-foreground">{UNATTRIBUTED_HINT}</p>
      </div>
    );
  }

  return (
    <SectionCard title="6. Hiệu quả truyền thông" icon={Megaphone}>
      {body}
    </SectionCard>
  );
}
