import { useMemo } from "react";
import { AssetCell, ReportTable, type ReportColumn, type ReportVariant } from "@/components/asset-owner-portal/periodic-report/ReportTable";
import { Button } from "@/components/ui/button";
import { OUTCOME_KIND_LABEL } from "@/lib/ownerOutcomes";
import {
  assetPriceRatioPct,
  FUNNEL_SOURCE_LABEL,
  funnelChannelLabel,
  UNATTRIBUTED_LABEL,
  type FunnelAssetRow,
  type FunnelCounts,
  type MarketingFunnel,
} from "@/lib/ownerMarketing/funnel";
import { formatMoneyFull } from "@/utils/money";

const fmt = (n: number) => n.toLocaleString("en-US");
const day = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

interface BreakdownRow extends FunnelCounts {
  key: string;
  label: string;
  /** "2 link" / "1 đơn" — trống ở dòng "Không xác định nguồn". */
  items: string;
  unattributed?: boolean;
}

const COUNT_COLUMNS: ReportColumn<BreakdownRow>[] = [
  { label: "Gửi", render: (r) => (r.unattributed ? "—" : fmt(r.sent)), numeric: true },
  { label: "Bấm", render: (r) => (r.unattributed ? "—" : fmt(r.clicks)), numeric: true },
  { label: "Xem", render: (r) => (r.unattributed ? "—" : fmt(r.visitors)), numeric: true },
  { label: "Lưu", render: (r) => fmt(r.saves), numeric: true },
  { label: "Đăng ký", render: (r) => fmt(r.registrations), numeric: true },
];

function breakdownColumns(first: string): ReportColumn<BreakdownRow>[] {
  return [
    {
      label: first,
      render: (r) => (
        <div className="min-w-0">
          <p className={r.unattributed ? "text-muted-foreground" : "font-medium text-foreground"}>{r.label}</p>
          {r.items && <p className="text-[11px] text-muted-foreground">{r.items}</p>}
        </div>
      ),
      className: "w-[34%]",
    },
    ...COUNT_COLUMNS,
  ];
}

const unattributedRow = (f: MarketingFunnel): BreakdownRow | null =>
  f.unattributed.saves + f.unattributed.registrations > 0
    ? {
        key: "unknown",
        label: UNATTRIBUTED_LABEL,
        items: "",
        unattributed: true,
        sent: 0,
        opened: 0,
        clicks: 0,
        visitors: 0,
        saves: f.unattributed.saves,
        registrations: f.unattributed.registrations,
      }
    : null;

/** Theo nguồn: tự truyền thông · sàn làm · link lẻ · không xác định nguồn. */
export function FunnelSourceTable({ funnel, variant }: { funnel: MarketingFunnel; variant: ReportVariant }) {
  const rows = useMemo(() => {
    const out: BreakdownRow[] = funnel.bySource.map((s) => ({
      ...s,
      key: s.key,
      label: FUNNEL_SOURCE_LABEL[s.key],
      items: s.key === "platform" ? `${fmt(s.items)} đơn` : `${fmt(s.items)} link`,
    }));
    const u = unattributedRow(funnel);
    return u ? [...out, u] : out;
  }, [funnel]);
  if (!rows.length) return null;
  return <ReportTable columns={breakdownColumns("Nguồn")} rows={rows} rowKey={(r) => r.key} variant={variant} />;
}

/** Theo kênh: từng kênh riêng của đơn vị (link) và từng gói sàn làm. */
export function FunnelChannelTable({ funnel, variant }: { funnel: MarketingFunnel; variant: ReportVariant }) {
  const rows = useMemo(
    () =>
      funnel.byChannel.map<BreakdownRow>((c) => ({
        ...c,
        key: `${c.kind}:${c.key}`,
        label: funnelChannelLabel(c),
        items: c.kind === "platform" ? `${fmt(c.items)} đơn` : `${fmt(c.items)} link`,
      })),
    [funnel],
  );
  if (!rows.length) return null;
  return <ReportTable columns={breakdownColumns("Kênh")} rows={rows} rowKey={(r) => r.key} variant={variant} />;
}

function outcomeText(a: FunnelAssetRow): string {
  if (!a.outcome) return "Chưa có kết quả trong kỳ";
  const ratio = assetPriceRatioPct(a);
  const base = `${OUTCOME_KIND_LABEL[a.outcome]} · ${day(a.outcomeDate)}`;
  return ratio !== null ? `${base} · ${ratio}% giá KĐ` : base;
}

const withUnknown = (n: number, unknown: number) => (unknown > 0 ? `${fmt(n)} (+${fmt(unknown)} chưa rõ)` : fmt(n));

interface FunnelAssetTableProps {
  funnel: MarketingFunnel;
  variant: ReportVariant;
  /** Có ⇒ mỗi dòng có nút "Xem riêng" (lọc tab theo tài sản). */
  onSelect?: (assetId: string) => void;
}

/** Theo tài sản: lượt bấm → đăng ký (kèm phần chưa rõ nguồn) và kết quả phiên trong kỳ. */
export function FunnelAssetTable({ funnel, variant, onSelect }: FunnelAssetTableProps) {
  const columns = useMemo<ReportColumn<FunnelAssetRow>[]>(
    () => [
      {
        label: "Tài sản",
        render: (a) => (
          <div className="flex items-start justify-between gap-2">
            <AssetCell title={a.title} code={a.assetCode} branchName={a.branchName} />
            {onSelect && a.assetId && (
              <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => onSelect(a.assetId!)}>
                Xem riêng
              </Button>
            )}
          </div>
        ),
        className: "w-[34%]",
      },
      { label: "Bấm", render: (a) => fmt(a.clicks), numeric: true },
      { label: "Lưu", render: (a) => withUnknown(a.saves, a.savesUnattributed), numeric: true },
      { label: "Đăng ký", render: (a) => withUnknown(a.registrations, a.registrationsUnattributed), numeric: true },
      { label: "Người tham gia", render: (a) => (a.participants === null ? "—" : fmt(a.participants)), numeric: true },
      { label: "Kết quả", render: (a) => outcomeText(a) },
      { label: "Giá trúng", render: (a) => formatMoneyFull(a.outcome === "sold" ? a.price : null), numeric: true },
    ],
    [onSelect],
  );
  return (
    <ReportTable
      columns={columns}
      rows={funnel.byAsset}
      rowKey={(a, i) => `${a.assetCode ?? a.title}-${i}`}
      variant={variant}
    />
  );
}
