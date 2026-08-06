import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ReportCard from "@/components/admin/reports/ReportCard";
import { HelpHint } from "@/components/admin/HelpHint";
import {
  DistBarChart, DistDonutChart, LegalFlagsPanel, MonthTrendChart,
} from "@/components/admin/crm/prospect/parts/AssetStructureCharts";
import { AuctionHistoryFilterBar } from "@/components/admin/crm/prospect/parts/AuctionHistoryFilterBar";
import { AuctionHistoryTable } from "@/components/admin/crm/prospect/parts/AuctionHistoryTable";
import { useProspectDetail } from "@/hooks/useProspects";
import { formatVnd } from "@/lib/advertising/slug";
import {
  aggregateHistory,
  filterHistory,
  hasActiveHistoryFilters,
  DEFAULT_HISTORY_FILTERS,
  type HistoryFilters,
} from "@/lib/prospects/auctionHistory";
import type { ProspectKind } from "@/lib/prospects/types";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Props {
  kind: ProspectKind;
  prospectId: string;
}

export function ProspectAuctionHistoryTab({ kind, prospectId }: Props) {
  const { data, isLoading, isError } = useProspectDetail(kind, prospectId);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);

  const all = useMemo(() => data?.history ?? [], [data]);
  const rows = useMemo(() => filterHistory(all, filters), [all, filters]);
  const agg = useMemo(() => aggregateHistory(rows), [rows]);
  const active = hasActiveHistoryFilters(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Không tải được lịch sử đấu giá của khách hàng này.
      </p>
    );
  }

  const counterpartyTitle =
    kind === "asset_owner" ? "Tổ chức đấu giá đang hợp tác" : "Chủ tài sản đang phục vụ";

  // Có chi nhánh thì tab này gộp cả tin của chúng — phải nói rõ, vì KPI ở đây
  // sẽ lớn hơn cột "Tài sản" ngoài danh sách (cột đó cố ý chỉ đếm riêng).
  const hasUnits = (data.branches?.length ?? 0) > 0;
  const hasGroups = (data.groups?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Bộ lọc cấp tab — chi phối cả KPI, biểu đồ lẫn bảng */}
      <AuctionHistoryFilterBar rows={all} filters={filters} onChange={setFilters} />

      {data.profile.aliases.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Alias đã lưu:</span>
          {data.profile.aliases.map((a) => (
            <Badge key={a} variant="secondary">{a}</Badge>
          ))}
        </div>
      )}

      {hasUnits && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          Số liệu gồm cả {data.branches.length} chi nhánh / AMC trực thuộc
          <HelpHint side="bottom" label="Phạm vi số liệu">
            <p>
              Mọi KPI và biểu đồ ở đây gộp tin của trụ sở chính lẫn các đơn vị trực thuộc.
            </p>
            <p>
              Vì vậy con số ở đây <strong>lớn hơn</strong> cột &quot;Tài sản&quot; ngoài danh
              sách — cột đó chỉ đếm riêng từng pháp nhân, do chi nhánh cũng là một dòng riêng.
            </p>
            <p>
              Chọn <strong>Chi nhánh/AMC</strong> ở bộ lọc để xem riêng từng nơi.
            </p>
          </HelpHint>
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi
          label="Tổng tài sản"
          value={String(agg.totals.listings)}
          hint={active ? `trên tổng ${all.length}` : undefined}
        />
        <Kpi label="Tổng giá khởi điểm" value={formatVnd(agg.totals.startingPriceSum)} />
        <Kpi label="Giá trung bình" value={formatVnd(agg.totals.avgPrice)} />
        <Kpi
          label="Đấu thành công"
          value={String(agg.totals.won)}
          hint={`${agg.totals.successRate}% số tài sản`}
        />
        <Kpi label="Tồn đọng" value={String(agg.totals.stuck)} hint="Qua ≥2 phiên chưa thành" />
        <Kpi label="Số tỉnh/thành" value={String(agg.totals.provinces)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {hasGroups && (
          <DistBarChart
            title="Phân bổ theo cụm"
            subtitle="Tin của trụ sở chính và chi nhánh chưa xếp gom vào “Chưa xếp cụm”"
            data={agg.byGroup}
          />
        )}
        {hasUnits && (
          <DistBarChart
            title="Phân bổ theo chi nhánh / AMC"
            subtitle="Trụ sở chính và từng đơn vị trực thuộc"
            data={agg.byUnit}
          />
        )}
        <DistBarChart
          title="Phân bổ theo tỉnh/thành"
          subtitle="Theo địa chỉ tài sản"
          data={agg.byProvince}
        />
        <DistBarChart title="Phân bổ theo loại tài sản" data={agg.byAssetType} />
        <DistDonutChart
          title="Phân bổ theo pháp lý"
          subtitle="Theo tình trạng pháp lý ghi trên tin đấu giá"
          data={agg.byLegal}
        />
        <DistDonutChart title="Phân bổ theo trạng thái đấu giá" data={agg.byStatus} />
        <MonthTrendChart data={agg.byMonth} />
        {/* Không theo bộ lọc: đây là tài sản khách TỰ ĐĂNG (asset_postings),
            khác nguồn với tin đấu giá đang lọc ở trên. */}
        <LegalFlagsPanel flags={data.legal_flags} />
      </div>

      <ReportCard title={counterpartyTitle} empty={agg.byCounterparty.length === 0}>
        <div className="space-y-2">
          {agg.byCounterparty.map((c) => (
            <div key={c.id ?? c.label} className="flex items-center gap-3">
              <span className="text-sm text-foreground flex-1 truncate">{c.label}</span>
              <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${c.pct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
                {c.count} · {c.pct}%
              </span>
            </div>
          ))}
        </div>
      </ReportCard>

      {/* Danh sách chi tiết để cuối: phần trên là bức tranh tổng quan, ai cần
          tra từng tài sản thì cuộn xuống. */}
      <AuctionHistoryTable
        rows={rows}
        totalCount={all.length}
        filtered={active}
        showUnit={hasUnits}
      />
    </div>
  );
}
