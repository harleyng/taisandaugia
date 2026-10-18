import { useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { ListPager } from "@/components/portal/auction-sessions/list/ListPager";
import { OrgContractFilters } from "@/components/portal/bidding-contracts/OrgContractFilters";
import { OrgContractsTable } from "@/components/portal/bidding-contracts/OrgContractsTable";
import { ConsignmentCanvas } from "@/components/portal/consignment/ConsignmentCanvas";
import { useSessionOrg } from "@/hooks/useAuctionSessions";
import { useOrgBiddingContracts } from "@/hooks/useOrgBiddingContracts";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { PAGE_SIZES, paginate } from "@/lib/auctionSessions/sessionList";
import { contractsCsv, REVIEW_FILTERS, type DepositFilter, type ReviewFilter } from "@/lib/biddingContracts/contractDetail";
import {
  depositChoices,
  matchesReviewTab,
  passesOrgListFilters,
  sessionsOfContracts,
  sortOrgContracts,
  type OrgListFilters,
} from "@/lib/biddingContracts/orgContractList";
import { sessionContractPath, type ContractDetailState } from "@/lib/biddingContracts/paths";
import { saveBlob } from "@/lib/pdf/saveBlob";
import { DEPOSIT_STATUS_LABELS, type ContractWithSession } from "@/types/bidding-contract";

/** Tab trên URL viết bằng slug tiếng Việt như danh sách phiên. */
const TAB_SLUG: Record<ReviewFilter, string> = {
  all: "tat-ca",
  pending: "cho-duyet",
  needs_info: "can-bo-sung",
  approved: "da-duyet",
  rejected: "tu-choi",
};
const SLUG_TAB = Object.fromEntries(Object.entries(TAB_SLUG).map(([k, v]) => [v, k])) as Record<string, ReviewFilter>;

const DEFAULTS = { tab: "tat-ca", q: "", phien: "", "dat-truoc": "all", trang: "1", so: "10" };
const ALLOWED = {
  tab: Object.values(TAB_SLUG),
  "dat-truoc": ["all", ...Object.keys(DEPOSIT_STATUS_LABELS)],
  so: PAGE_SIZES.map(String),
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <ConsignmentCanvas>
      <div className="space-y-3 rounded-2xl bg-card p-10 text-center shadow-card">{children}</div>
    </ConsignmentCanvas>
  );
}

/**
 * /portal/ho-so-tham-gia — hồ sơ tham gia của mọi phiên trong tổ chức (design
 * "Phien Dau Gia - Cong Cong Ty": pdg-hslist.js). Bấm một dòng mở trang chi tiết
 * /portal/phien-dau-gia/:id/ho-so/:code; đường dẫn ở đó quay về đúng danh sách này.
 */
export default function HoSoThamGiaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: orgLoading } = useSessionOrg();
  const { data: contracts = [], isLoading, error } = useOrgBiddingContracts();
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, ALLOWED);

  const tab = SLUG_TAB[f.tab] ?? "all";
  const filters: OrgListFilters = { sessionId: f.phien, deposit: f["dat-truoc"] as DepositFilter, q: f.q };
  // Mọi thay đổi lọc đưa về trang 1.
  const setFilterValues = (patch: Partial<OrgListFilters>) => {
    const next: Record<string, string> = { trang: "1" };
    if (patch.sessionId !== undefined) next.phien = patch.sessionId;
    if (patch.deposit !== undefined) next["dat-truoc"] = patch.deposit;
    if (patch.q !== undefined) next.q = patch.q;
    setFilters(next);
  };

  const all = useMemo(() => sortOrgContracts(contracts), [contracts]);
  const sessions = useMemo(() => sessionsOfContracts(contracts), [contracts]);
  const filtered = all.filter((r) => passesOrgListFilters(r, filters));
  const rows = filtered.filter((r) => matchesReviewTab(r, tab));
  const size = Number(f.so);
  const pg = paginate(rows, Number(f.trang) || 1, size);
  const hasFilter = !!(filters.q.trim() || filters.sessionId || filters.deposit !== "all");

  const open = (c: ContractWithSession) =>
    navigate(sessionContractPath(c.session_id, c.code), {
      state: { fromList: `${location.pathname}${location.search}` } satisfies ContractDetailState,
    });
  const exportList = () =>
    saveBlob(
      new Blob([contractsCsv(rows, { withSession: true })], { type: "text/csv;charset=utf-8" }),
      "ho-so-tham-gia.csv",
    );

  if (orgLoading || isLoading) {
    return (
      <Shell>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải hồ sơ tham gia…
        </p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="font-semibold text-foreground">Không tải được hồ sơ tham gia</p>
        <p className="text-sm text-muted-foreground">Vui lòng tải lại trang.</p>
      </Shell>
    );
  }

  return (
    <ConsignmentCanvas>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">Hồ sơ tham gia</h1>
          <p className="mt-0.5 max-w-[640px] text-[13.5px] text-muted-foreground">
            Xét duyệt điều kiện tham gia của người mua và theo dõi tiền đặt trước ở tất cả các phiên.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-9 gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold"
          disabled={rows.length === 0}
          onClick={exportList}
        >
          <Download className="h-4 w-4" />
          Xuất danh sách
        </Button>
      </header>

      <section className="rounded-2xl bg-card shadow-card">
        <div className="border-b px-4 pt-1.5 sm:px-[22px]">
          <OwnerTabBar
            aria-label="Lọc hồ sơ theo trạng thái duyệt"
            listClassName="-mb-px shadow-none"
            value={tab}
            onValueChange={(v) => setFilters({ tab: TAB_SLUG[v], trang: "1" })}
            items={REVIEW_FILTERS.map(([key, label]) => ({
              value: key,
              label,
              count: filtered.filter((r) => matchesReviewTab(r, key)).length,
            }))}
          />
        </div>
        <OrgContractFilters
          values={filters}
          sessions={sessions}
          deposits={depositChoices(contracts)}
          onChange={setFilterValues}
        />

        {rows.length > 0 ? (
          <>
            <OrgContractsTable rows={pg.slice} onOpen={open} />
            <ListPager
              page={pg.page}
              pages={pg.pages}
              size={size}
              start={pg.start}
              total={rows.length}
              unit="hồ sơ"
              onPage={(p) => setFilters({ trang: String(p) })}
              onSize={(n) => setFilters({ so: String(n), trang: "1" })}
            />
          </>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <b className="mb-1 block text-[15px] font-semibold text-foreground">
              {contracts.length ? "Không có hồ sơ nào khớp" : "Chưa có hồ sơ tham gia nào"}
            </b>
            {hasFilter && "Thử từ khoá hoặc bộ lọc khác."}
          </div>
        )}
      </section>
    </ConsignmentCanvas>
  );
}
