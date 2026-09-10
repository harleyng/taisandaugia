import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { useAdminAssetPostings } from "@/hooks/useAdminAssetPostings";
import { AssetPostingTable } from "@/components/admin/asset-postings/AssetPostingTable";
import { REVIEW_STATUS_TABS, type ReviewStatusFilter } from "@/lib/asset-posting/reviewStatus";
import { ASSET_POSTING_STATUS_LABELS, type AssetPostingStatus } from "@/types/asset-posting";

const POSTING_STATUSES = Object.keys(ASSET_POSTING_STATUS_LABELS) as AssetPostingStatus[];

const FILTER_DEFAULTS = { review: "all", status: "all", q: "" };
const FILTER_OPTIONS = {
  review: REVIEW_STATUS_TABS.map((t) => t.key),
  status: ["all", ...POSTING_STATUSES],
};

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
  ].join(" ");

/** Hàng chờ duyệt hồ sơ tài sản do chủ tài sản số hoá. Admin xem được cả hồ sơ nháp. */
export default function AdminAssetPostingsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { data: rows = [], isLoading, refetch, isFetching } = useAdminAssetPostings();
  const [filters, setFilter] = useUrlFilterState(FILTER_DEFAULTS, FILTER_OPTIONS);

  // Lọc client-side: hàng chờ duyệt là tập nhỏ, không đáng để đẩy sang server.
  const byReview = useMemo(
    () => (filters.review === "all" ? rows : rows.filter((r) => r.review_status === filters.review)),
    [rows, filters.review],
  );

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return byReview.filter((r) => {
      if (filters.status !== "all" && r.status !== filters.status) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.province ?? "").toLowerCase().includes(q) ||
        (r.profiles?.name ?? "").toLowerCase().includes(q) ||
        (r.profiles?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [byReview, filters.status, filters.q]);

  const countFor = (k: ReviewStatusFilter) =>
    k === "all" ? rows.length : rows.filter((r) => r.review_status === k).length;

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tài sản tự nguyện</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Xem xét, bổ sung thông tin và phê duyệt hồ sơ tài sản do chủ tài sản số hoá
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Tab theo trạng thái duyệt */}
      <div className="flex w-fit gap-1 rounded-xl border border-border bg-card p-1">
        {REVIEW_STATUS_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter("review", key)} className={pill(filters.review === key)}>
            {label}
            <span
              className={[
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                filters.review === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {countFor(key)}
            </span>
          </button>
        ))}
      </div>

      {/* Lọc phụ: trạng thái hồ sơ của chủ tài sản + tìm kiếm */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Tìm theo tên tài sản, khu vực, chủ tài sản…"
            className="h-9 w-72 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
        >
          <option value="all">Mọi trạng thái hồ sơ</option>
          {POSTING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ASSET_POSTING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : (
          <AssetPostingTable
            rows={visible}
            // Mang query string sang chi tiết để nút quay lại giữ nguyên bộ lọc.
            onOpen={(row) => navigate(`/admin/tai-san/${row.id}`, { state: { listSearch: search } })}
          />
        )}
      </div>
    </div>
  );
}
