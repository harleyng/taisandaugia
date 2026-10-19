import { useMemo, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuctionSiteLinks } from "@/components/admin/auction-sessions/AuctionSiteLinks";
import { MonitorDossierStats } from "@/components/admin/auction-sessions/MonitorDossierStats";
import { MonitorLotsTable } from "@/components/admin/auction-sessions/MonitorLotsTable";
import { MonitorStateBadge } from "@/components/admin/auction-sessions/MonitorStateBadge";
import { useAdminAuctionSessionDetail } from "@/hooks/useAdminAuctionMonitor";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { formatDateTime, formatDateTimeRange } from "@/lib/auctionCore/datetime";
import {
  AUCTION_FORMAT_LABELS,
  BIDDING_METHOD_LABELS,
  isVisibleOnAuctionSite,
  liveLotCount,
  monitorStateOf,
  SALE_CONTRACT_STATUS_LABELS,
  upcomingDetailOf,
} from "@/lib/auctionMonitor/monitor";
import { formatMoneyFull } from "@/utils/money";
import { cn } from "@/lib/utils";

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

/** /admin/phien-dau-gia/:id — giám sát một phiên: lịch, lô (trạng thái sống), hồ sơ, HĐ mua bán. */
export default function AdminAuctionSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useAdminAuctionSessionDetail(id);
  const canSeeContracts = useHasAdminPermission("hop-dong");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [dataUpdatedAt]);

  const back = (
    <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/admin/phien-dau-gia")}>
      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
      Phiên đấu giá
    </Button>
  );

  if (isLoading || error || !data) {
    return (
      <div className="space-y-4 px-6 py-8">
        {back}
        <div className="rounded-xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {isLoading ? "Đang tải..." : "Không tìm thấy phiên đấu giá, hoặc bạn không có quyền xem."}
        </div>
      </div>
    );
  }

  const s = data.session;
  const live = liveLotCount(data);
  const state = monitorStateOf({ ...s, live_lot_count: live }, now);

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="space-y-3">
        {back}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-muted-foreground">{s.code}</span>
              <MonitorStateBadge state={state} detail={upcomingDetailOf({ ...s, live_lot_count: live }, now)} />
            </div>
            <h1 className="text-xl font-bold text-foreground">{s.title}</h1>
            <p className="text-sm text-muted-foreground">{s.org_name ?? "—"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Làm mới
          </Button>
        </div>
        {isVisibleOnAuctionSite(s) ? (
          <AuctionSiteLinks sessionId={s.id} live={state === "live"} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {s.status === "draft" ? "Phiên nháp chưa công bố" : "Phiên đã huỷ"} — không hiện trên sàn đấu giá.
            {s.cancelled_reason ? ` Lý do huỷ: ${s.cancelled_reason}` : ""}
          </p>
        )}
      </div>

      <Section title="Thông tin phiên">
        <dl className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Thời gian đấu" value={formatDateTimeRange(s.starts_at, s.ends_at)} />
          <Fact label="Bán hồ sơ" value={formatDateTimeRange(s.registration_start_at, s.registration_end_at)} />
          <Fact
            label="Hình thức"
            value={[AUCTION_FORMAT_LABELS[s.auction_format] ?? s.auction_format, BIDDING_METHOD_LABELS[s.bidding_method] ?? s.bidding_method].join(" · ")}
          />
          <Fact label="Phí hồ sơ" value={s.dossier_fee != null ? formatMoneyFull(s.dossier_fee) : null} />
          <Fact label="Địa điểm" value={[s.venue, s.province].filter(Boolean).join(", ")} />
          <Fact label="Công bố" value={s.published_at ? formatDateTime(s.published_at) : null} />
          <Fact label="Chốt danh sách điểm danh" value={s.roster_closed_at ? formatDateTime(s.roster_closed_at) : null} />
          <Fact label="Hoàn tất phiên" value={s.finalized_at ? formatDateTime(s.finalized_at) : null} />
        </dl>
      </Section>

      <Section
        title={`Tài sản (${data.lots.length})`}
        aside={live > 0 ? <span className="text-xs text-primary">Đang đấu {live} lô · tự làm mới mỗi 10 giây</span> : undefined}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <MonitorLotsTable lots={data.lots} />
        </div>
      </Section>

      <Section title="Hồ sơ tham gia">
        <MonitorDossierStats stats={data.dossiers} />
      </Section>

      <Section title={`Hợp đồng mua bán (${data.sale_contracts.length})`}>
        {data.sale_contracts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-8 text-center text-sm text-muted-foreground">
            Chưa có hợp đồng mua bán.
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {data.sale_contracts.map((c) => {
              const lot = data.lots.find((l) => l.id === c.lot_id);
              const body = (
                <>
                  <span className="font-mono text-xs font-semibold text-foreground">{c.code ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {lot ? `Lô ${lot.lot_no} · ${lot.title}` : "—"}
                  </span>
                  <span className="tabular-nums text-foreground">{formatMoneyFull(c.price)}</span>
                  <span className="w-28 text-right text-xs text-muted-foreground">
                    {SALE_CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </>
              );
              return (
                <li key={c.id}>
                  {canSeeContracts ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/hop-dong/mua-ban/${c.id}`)}
                      className="flex w-full items-center gap-4 px-4 py-3 text-left text-sm hover:bg-muted/30"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 px-4 py-3 text-sm">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
