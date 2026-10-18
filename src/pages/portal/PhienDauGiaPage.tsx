import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerTabBar } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { ConsignmentCanvas } from "@/components/portal/consignment/ConsignmentCanvas";
import { SessionsTable } from "@/components/portal/auction-sessions/list/SessionsTable";
import {
  SessionListFilters,
  type SessionListFilterValues,
} from "@/components/portal/auction-sessions/list/SessionListFilters";
import { ListPager } from "@/components/portal/auction-sessions/list/ListPager";
import { useOrgAuctionSessions, useSessionOrg } from "@/hooks/useAuctionSessions";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { stripViDiacritics } from "@/lib/normalizeVi";
import { VIETNAM_PROVINCE_NAMES, VIETNAM_PROVINCE_NAMES_2025 } from "@/constants/vietnam-provinces";
import {
  matchesSessionQuery,
  matchesTab,
  matchesTime,
  PAGE_SIZES,
  paginate,
  SESSION_LIST_TABS,
  sortSessionRows,
  TIME_FILTERS,
  type SessionListTab,
  type TimeFilter,
} from "@/lib/auctionSessions/sessionList";
import type { OrgSessionListRow } from "@/types/auction-session";

const DEFAULTS = { tab: "tat-ca", q: "", tg: "", tu: "", den: "", tinh: "", "hinh-thuc": "", trang: "1", so: "10" };
const ALLOWED = {
  tab: SESSION_LIST_TABS.map((t) => t.key),
  tg: [...TIME_FILTERS.map((t) => t.key), "custom"],
  "hinh-thuc": ["", "truc_tiep", "truc_tuyen"],
  so: PAGE_SIZES.map(String),
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <ConsignmentCanvas>
      <div className="space-y-3 rounded-2xl bg-card p-10 text-center shadow-card">{children}</div>
    </ConsignmentCanvas>
  );
}

/** /portal/phien-dau-gia — danh sách phiên của tổ chức (design "Phien Dau Gia - Cong Cong Ty"). */
export default function PhienDauGiaPage() {
  const navigate = useNavigate();
  const { auctionOrgId, isApproved, loading: orgLoading } = useSessionOrg();
  const { data: sessions = [], isLoading, error } = useOrgAuctionSessions();
  const canCreate = useHasOrgPermission("phien-dau-gia", "create");
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, ALLOWED);

  const tab = f.tab as SessionListTab;
  const filters: SessionListFilterValues = {
    q: f.q,
    time: f.tg as TimeFilter,
    from: f.tu,
    to: f.den,
    prov: f.tinh,
    fmt: f["hinh-thuc"],
  };
  // Mọi thay đổi lọc đưa về trang 1.
  const setFilterValues = (patch: Partial<SessionListFilterValues>) => {
    const map: Record<keyof SessionListFilterValues, string> = {
      q: "q",
      time: "tg",
      from: "tu",
      to: "den",
      prov: "tinh",
      fmt: "hinh-thuc",
    };
    const next: Record<string, string> = { trang: "1" };
    for (const [k, v] of Object.entries(patch)) next[map[k as keyof SessionListFilterValues]] = v ?? "";
    setFilters(next);
  };

  // Gộp 34 tỉnh mới + 63 tỉnh cũ + tỉnh có trong dữ liệu; bỏ trùng theo tên không dấu
  // ("Thanh Hoá" = "Thanh Hóa").
  const provinces = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of [...VIETNAM_PROVINCE_NAMES_2025, ...VIETNAM_PROVINCE_NAMES, ...sessions.map((s) => s.province)]) {
      if (p && !seen.has(stripViDiacritics(p))) seen.set(stripViDiacritics(p), p);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "vi"));
  }, [sessions]);

  const now = new Date();
  const foldedProv = stripViDiacritics(filters.prov);
  // Lọc phụ (không gồm tab + ô tìm) — số trên tab đếm theo bộ lọc này.
  const passesFilters = (s: OrgSessionListRow) =>
    (!filters.prov || stripViDiacritics(s.province ?? "") === foldedProv) &&
    (!filters.fmt || s.auction_format === filters.fmt) &&
    matchesTime(s, filters.time, filters.from, filters.to, now);

  const filtered = sortSessionRows(sessions, now).filter(passesFilters);
  const folded = stripViDiacritics(filters.q.trim());
  const rows = filtered.filter((s) => matchesTab(tab, s, now) && matchesSessionQuery(s, folded));
  const size = Number(f.so);
  const pg = paginate(rows, Number(f.trang) || 1, size);
  const hasFilter = !!(folded || filters.prov || filters.fmt || filters.time);

  if (orgLoading || isLoading) {
    return (
      <Shell>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải phiên đấu giá…
        </p>
      </Shell>
    );
  }

  if (!isApproved || !auctionOrgId) {
    return (
      <Shell>
        <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="font-semibold text-foreground">Chưa thể tạo phiên đấu giá</p>
        <p className="text-sm text-muted-foreground">
          Tổ chức cần được duyệt KYC và liên kết với danh bạ tổ chức đấu giá trước khi tạo và công bố phiên.
        </p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="font-semibold text-foreground">Không tải được danh sách phiên</p>
        <p className="text-sm text-muted-foreground">Vui lòng tải lại trang.</p>
      </Shell>
    );
  }

  return (
    <ConsignmentCanvas>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em] text-foreground">Phiên đấu giá</h1>
          <p className="mt-0.5 max-w-[640px] text-[13.5px] text-muted-foreground">
            Gom tài sản vào phiên, khai báo lịch và công bố lên sàn cho người mua theo dõi.
          </p>
        </div>
        {canCreate && (
          <Button className="gap-1.5" onClick={() => navigate("/portal/phien-dau-gia/moi")}>
            <Plus className="h-4 w-4" />
            Tạo phiên
          </Button>
        )}
      </header>

      <section className="rounded-2xl bg-card shadow-card">
        <div className="border-b px-4 pt-1.5 sm:px-[22px]">
          <OwnerTabBar
            aria-label="Lọc phiên theo trạng thái"
            listClassName="-mb-px shadow-none"
            value={tab}
            onValueChange={(v) => setFilters({ tab: v, trang: "1" })}
            items={SESSION_LIST_TABS.map((t) => ({
              value: t.key,
              label: t.label,
              count: filtered.filter((s) => matchesTab(t.key, s, now)).length,
            }))}
          />
        </div>
        <SessionListFilters values={filters} provinces={provinces} onChange={setFilterValues} />

        {rows.length > 0 ? (
          <>
            <SessionsTable rows={pg.slice} onOpen={(s) => navigate(`/portal/phien-dau-gia/${s.id}`)} />
            <ListPager
              page={pg.page}
              pages={pg.pages}
              size={size}
              start={pg.start}
              total={rows.length}
              onPage={(p) => setFilters({ trang: String(p) })}
              onSize={(n) => setFilters({ so: String(n), trang: "1" })}
            />
          </>
        ) : (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <b className="mb-1 block text-[15px] font-semibold text-foreground">
              {sessions.length ? "Không có phiên nào khớp" : "Tổ chức chưa có phiên đấu giá nào"}
            </b>
            {hasFilter && "Thử từ khoá hoặc bộ lọc khác."}
          </div>
        )}
      </section>
    </ConsignmentCanvas>
  );
}
