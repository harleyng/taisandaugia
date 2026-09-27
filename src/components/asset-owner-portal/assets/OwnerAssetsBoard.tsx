import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, PackageOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReportOutcomeDialog } from "@/components/asset-owner-portal/outcomes/ReportOutcomeDialog";
import { cn } from "@/lib/utils";
import { claimToReportTarget, type ReportOutcomeTarget } from "@/lib/ownerOutcomeReport";
import {
  ASSET_PHASES,
  matchesAssetFilter,
  type OwnerAssetRow,
  type OwnerClaimRow,
} from "@/lib/ownerAssets";
import { AssetTabs } from "./AssetTabs";
import { ASSET_TABS, type AssetTab } from "./assetsUi";
import { AssetRowsTable } from "./AssetRowsTable";
import { ClaimInboxTable } from "./ClaimInboxTable";
import { AssetDetailDialog } from "./AssetDetailDialog";

const ALL = "__all";

interface OwnerAssetsBoardProps {
  rows: OwnerAssetRow[];
  claimRows: OwnerClaimRow[];
  loading: boolean;
  postingsError: boolean;
  onRetryPostings: () => void;
  /** null ở tenant Cá nhân — không có tin đã nhận nên không khai kết quả. */
  workspaceId: string | null;
  onConfirmClaim: (id: string) => void;
  onRejectClaim: (id: string) => void;
  onConfirmAllClaims: () => void;
  claimBusy: boolean;
  canConfirmAll: boolean;
  canCreatePosting: boolean;
  /** Tên chi nhánh chọn sẵn (?source= từ trang Chi nhánh). */
  initialBranch?: string;
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "vi"));
}

export function OwnerAssetsBoard({
  rows,
  claimRows,
  loading,
  postingsError,
  onRetryPostings,
  workspaceId,
  onConfirmClaim,
  onRejectClaim,
  onConfirmAllClaims,
  claimBusy,
  canConfirmAll,
  canCreatePosting,
  initialBranch,
}: OwnerAssetsBoardProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AssetTab>("all");
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState(initialBranch ?? "");
  const [category, setCategory] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [selected, setSelected] = useState<OwnerAssetRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // Giữ target khi đóng để dialog không trống chữ lúc đang tắt dần.
  const [reportTarget, setReportTarget] = useState<ReportOutcomeTarget | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const counts = useMemo(() => {
    const c = { mine: 0, claims: claimRows.length, all: rows.length } as Record<AssetTab, number>;
    for (const p of ASSET_PHASES) c[p] = 0;
    for (const r of rows) {
      c[r.phase]++;
      if (r.next.mine) c.mine++;
    }
    return c;
  }, [rows, claimRows]);

  // Không còn tin chờ xác nhận ⇒ ẩn tab, rơi về "Tất cả".
  const tabs = ASSET_TABS.filter((t) => t.id !== "claims" || claimRows.length > 0);
  const activeTab: AssetTab = tab === "claims" && claimRows.length === 0 ? "all" : tab;
  const isClaims = activeTab === "claims";

  const branches = useMemo(() => uniqueSorted([...rows, ...claimRows].map((x) => x.branch)), [rows, claimRows]);
  const categories = useMemo(() => uniqueSorted([...rows, ...claimRows].map((x) => x.category)), [rows, claimRows]);
  const filter = { query, branch, category };

  const visibleRows = rows.filter(
    (r) =>
      (activeTab === "all" || (activeTab === "mine" ? r.next.mine : r.phase === activeTab)) &&
      (!overdueOnly || r.overdue) &&
      matchesAssetFilter(r, filter),
  );
  const visibleClaims = claimRows.filter((c) => matchesAssetFilter(c, filter));

  const openRow = (row: OwnerAssetRow) => {
    setSelected(row);
    setDetailOpen(true);
  };

  const runCta = (row: OwnerAssetRow) => {
    const action = row.next.cta?.action;
    if (!action) return;
    if (action.kind === "navigate") {
      navigate(action.href);
      return;
    }
    const target = row.claim ? claimToReportTarget(row.claim) : null;
    if (!target || !workspaceId) return;
    setDetailOpen(false);
    setReportTarget(target);
    setReportOpen(true);
  };

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-2xl" aria-busy="true" aria-label="Đang tải tài sản" />;
  }

  if (rows.length === 0 && claimRows.length === 0 && !postingsError) {
    return (
      <div className="rounded-2xl border border-border bg-card">
        <EmptyState
          icon={PackageOpen}
          title="Chưa có tài sản nào"
          description="Số hoá tài sản hoặc xác nhận tin sàn tìm thấy để theo dõi từng giai đoạn tới lúc thu tiền."
          action={canCreatePosting && <Button onClick={() => navigate("/chu-tai-san/dang-tai-san")}>Số hoá tài sản</Button>}
        />
      </div>
    );
  }

  const shown = isClaims ? visibleClaims.length : visibleRows.length;
  const total = isClaims ? claimRows.length : rows.length;

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-[18px] shadow-sm ring-1 ring-border/60">
      <AssetTabs tabs={tabs} value={activeTab} counts={counts} onChange={setTab} />

      {isClaims && (
        <p className="pt-0.5 text-[13px] text-muted-foreground">
          Sàn tìm thấy các tin đăng có thể là tài sản của bạn. Xác nhận để đưa vào danh mục; tin không phải của bạn sẽ bị ẩn.
        </p>
      )}

      {postingsError && (
        <EmptyState
          compact
          tone="destructive"
          icon={AlertTriangle}
          title="Không tải được hồ sơ số hoá."
          description="Bảng vẫn hiện các tin đã nhận."
          action={
            <Button variant="outline" size="sm" onClick={onRetryPostings}>
              Thử lại
            </Button>
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, địa chỉ hoặc mã tài sản"
            aria-label="Tìm tài sản"
            className="h-[34px] pl-9 text-[13px]"
          />
        </div>
        {branches.length > 0 && (
          <Select value={branch || ALL} onValueChange={(v) => setBranch(v === ALL ? "" : v)}>
            <SelectTrigger className="h-[34px] w-auto min-w-[150px] text-[13px]" aria-label="Chi nhánh">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi chi nhánh</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {categories.length > 0 && (
          <Select value={category || ALL} onValueChange={(v) => setCategory(v === ALL ? "" : v)}>
            <SelectTrigger className="h-[34px] w-auto min-w-[150px] text-[13px]" aria-label="Loại tài sản">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi loại tài sản</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!isClaims && (
          <label
            className={cn(
              "flex h-[34px] cursor-pointer select-none items-center gap-1.5 rounded-lg border px-2.5 text-[13px]",
              overdueOnly ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground",
            )}
          >
            <Checkbox
              checked={overdueOnly}
              onCheckedChange={(v) => setOverdueOnly(v === true)}
              className={cn(overdueOnly && "border-destructive data-[state=checked]:bg-destructive")}
            />
            Chỉ tài sản chậm tiến độ
          </label>
        )}
        <span className="ml-auto text-[12.5px] tabular-nums text-muted-foreground">
          {shown} / {total} {isClaims ? "tin" : "tài sản"}
        </span>
        {isClaims && canConfirmAll && (
          <Button variant="outline" size="sm" className="h-[30px] text-[12.5px] font-semibold" disabled={claimBusy} onClick={onConfirmAllClaims}>
            Xác nhận tất cả
          </Button>
        )}
      </div>

      <div className="-mx-5 overflow-x-auto">
        {shown === 0 ? (
          <p className="py-7 text-center text-[13.5px] text-muted-foreground">
            {isClaims ? "Không có tin nào khớp bộ lọc." : "Không có tài sản nào khớp bộ lọc."}
          </p>
        ) : isClaims ? (
          <ClaimInboxTable rows={visibleClaims} onConfirm={onConfirmClaim} onReject={onRejectClaim} disabled={claimBusy} />
        ) : (
          <AssetRowsTable rows={visibleRows} onOpen={openRow} onCta={runCta} />
        )}
      </div>

      <AssetDetailDialog row={selected} open={detailOpen} onOpenChange={setDetailOpen} onCta={runCta} />
      {workspaceId && (
        <ReportOutcomeDialog open={reportOpen} onOpenChange={setReportOpen} workspaceId={workspaceId} target={reportTarget} />
      )}
    </section>
  );
}
