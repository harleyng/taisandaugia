/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Clock, Building2, ArrowRight, ExternalLink, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils/formatters";
import type { AssetOwnerClaim, ClaimStatus } from "@/types/asset-owner";

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string; icon: typeof Clock }> = {
  auto_claimed:         { label: "Tự động",     className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  pending_confirmation: { label: "Chờ xác nhận",className: "bg-amber-100 text-amber-700",    icon: Clock },
  confirmed:            { label: "Đã xác nhận", className: "bg-green-100 text-green-700",    icon: CheckCircle2 },
  rejected:             { label: "Đã từ chối",  className: "bg-muted text-muted-foreground", icon: XCircle },
};

const CONFIDENCE_CLASS = (score: number | null) => {
  if (!score) return "bg-muted text-muted-foreground";
  if (score >= 0.9) return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
};

// ─── Filter types ───────────────────────────────────────────────────────────

type TimePreset = "all" | "7d_future" | "14d_future" | "30d_future" | "30d_past" | "custom";
type StatusFilter = "all" | ClaimStatus;

const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all",                  label: "Tất cả" },
  { value: "confirmed",            label: "Đã xác nhận" },
  { value: "pending_confirmation", label: "Chờ xác nhận" },
  { value: "auto_claimed",         label: "Tự động" },
  { value: "rejected",             label: "Đã từ chối" },
];

const TIME_PRESETS: { value: TimePreset; label: string }[] = [
  { value: "all",        label: "Tất cả thời gian" },
  { value: "7d_future",  label: "7 ngày tới" },
  { value: "14d_future", label: "14 ngày tới" },
  { value: "30d_future", label: "30 ngày tới" },
  { value: "30d_past",   label: "30 ngày trước" },
  { value: "custom",     label: "Tuỳ chọn..." },
];

const ROUND_OPTIONS = [
  { value: "0", label: "Tất cả lần ĐG" },
  { value: "2", label: "≥ 2 vòng" },
  { value: "3", label: "≥ 3 vòng" },
  { value: "4", label: "≥ 4 vòng" },
];

function getProvince(claim: AssetOwnerClaim): string {
  const addr = claim.listing?.address as Record<string, unknown> | null;
  return (addr?.province as string) ?? (addr?.city as string) ?? "";
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  claims: AssetOwnerClaim[];
  roundCountsByListing?: Record<string, number>;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onConfirmAll: () => void;
  isProcessing: boolean;
  initialMatchedName?: string;
}

// ─── Main component ──────────────────────────────────────────────────────────

export const ClaimsTable = ({ claims, roundCountsByListing = {}, onConfirm, onReject, onConfirmAll, isProcessing, initialMatchedName }: Props) => {
  const navigate = useNavigate();

  const [search, setSearch]                   = useState("");
  const [statusFilter, setStatusFilter]       = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter]   = useState("all");
  const [provinceFilter, setProvinceFilter]   = useState("all");
  const [matchedNameFilter, setMatchedNameFilter] = useState(initialMatchedName ?? "all");
  const [timePreset, setTimePreset]           = useState<TimePreset>("all");
  const [customFrom, setCustomFrom]           = useState("");
  const [customTo, setCustomTo]               = useState("");
  const [minRounds, setMinRounds]             = useState("0");

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    claims.forEach((c) => { if (c.listing?.property_type_slug) set.add(c.listing.property_type_slug); });
    return [...set].sort();
  }, [claims]);

  const availableProvinces = useMemo(() => {
    const set = new Set<string>();
    claims.forEach((c) => { const p = getProvince(c); if (p) set.add(p); });
    return [...set].sort();
  }, [claims]);

  const availableMatchedNames = useMemo(() => {
    const set = new Set<string>();
    claims.forEach((c) => { if (c.matched_name) set.add(c.matched_name); });
    return [...set].sort();
  }, [claims]);

  const filtered = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    let filterFrom: string | null = null;
    let filterTo: string | null = null;
    if (timePreset === "7d_future")  { filterFrom = today; filterTo = new Date(now.getTime() + 7  * 86400_000).toISOString().slice(0, 10); }
    if (timePreset === "14d_future") { filterFrom = today; filterTo = new Date(now.getTime() + 14 * 86400_000).toISOString().slice(0, 10); }
    if (timePreset === "30d_future") { filterFrom = today; filterTo = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10); }
    if (timePreset === "30d_past")   { filterFrom = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10); filterTo = today; }
    if (timePreset === "custom")     { filterFrom = customFrom || null; filterTo = customTo || null; }

    const minR = Number(minRounds);

    return claims.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const inTitle = (c.listing?.title ?? "").toLowerCase().includes(q);
        const inAddr  = JSON.stringify(c.listing?.address ?? "").toLowerCase().includes(q);
        if (!inTitle && !inAddr) return false;
      }
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (categoryFilter !== "all" && c.listing?.property_type_slug !== categoryFilter) return false;
      if (provinceFilter !== "all" && getProvince(c) !== provinceFilter) return false;
      if (matchedNameFilter !== "all" && c.matched_name !== matchedNameFilter) return false;
      if (minR > 0) {
        const rc = c.listing_id ? (roundCountsByListing[c.listing_id] ?? 0) : 0;
        if (rc < minR) return false;
      }
      if (filterFrom || filterTo) {
        const ca = (c.listing as any)?.custom_attributes as Record<string, any> | null;
        const aDate: string | undefined = ca?.auction_date ?? ca?.auction_time;
        if (!aDate) return false;
        const dateStr = aDate.slice(0, 10);
        if (filterFrom && dateStr < filterFrom) return false;
        if (filterTo   && dateStr > filterTo)   return false;
      }
      return true;
    });
  }, [claims, roundCountsByListing, search, statusFilter, categoryFilter, provinceFilter, matchedNameFilter, minRounds, timePreset, customFrom, customTo]);

  const pendingCount  = claims.filter((c) => c.status === "pending_confirmation").length;
  const pendingInView = filtered.filter((c) => c.status === "pending_confirmation").length;
  const countFor = (s: StatusFilter) => s === "all" ? claims.length : claims.filter((c) => c.status === s).length;

  const hasSecondaryFilter = categoryFilter !== "all" || provinceFilter !== "all"
    || matchedNameFilter !== "all" || timePreset !== "all" || minRounds !== "0";
  const hasAnyFilter = !!search || statusFilter !== "all" || hasSecondaryFilter;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setProvinceFilter("all");
    setMatchedNameFilter("all");
    setTimePreset("all");
    setCustomFrom("");
    setCustomTo("");
    setMinRounds("0");
  };

  return (
    <div className="space-y-3">
      {/* Row 1: search + secondary filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Tìm tài sản..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Secondary filter selects — only render when data available */}
        {availableCategories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[130px] text-sm">
              <SelectValue placeholder="Loại BĐS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại BĐS</SelectItem>
              {availableCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {availableProvinces.length > 0 && (
          <Select value={provinceFilter} onValueChange={setProvinceFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[120px] text-sm">
              <SelectValue placeholder="Tỉnh/TP" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả tỉnh/TP</SelectItem>
              {availableProvinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {availableMatchedNames.length > 1 && (
          <Select value={matchedNameFilter} onValueChange={setMatchedNameFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] text-sm">
              <SelectValue placeholder="Chi nhánh / AMC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả chi nhánh</SelectItem>
              {availableMatchedNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={timePreset} onValueChange={(v) => setTimePreset(v as TimePreset)}>
          <SelectTrigger className="h-9 w-auto min-w-[140px] text-sm">
            <SelectValue placeholder="Thời gian" />
          </SelectTrigger>
          <SelectContent>
            {TIME_PRESETS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={minRounds} onValueChange={setMinRounds}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] text-sm">
            <SelectValue placeholder="Lần đấu giá" />
          </SelectTrigger>
          <SelectContent>
            {ROUND_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasAnyFilter && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Custom date range */}
      {timePreset === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Từ</span>
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-36 text-xs" />
          <span className="text-xs text-muted-foreground">đến</span>
          <Input type="date" value={customTo}   onChange={(e) => setCustomTo(e.target.value)}   className="h-8 w-36 text-xs" />
        </div>
      )}

      {/* Row 2: status pills + result count */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_PILLS.map(({ value, label }) => {
            const count = countFor(value);
            const isActive = statusFilter === value;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                {label}
                <span className={cn(
                  "text-[10px] font-semibold rounded-full px-1.5 py-px tabular-nums",
                  isActive ? "bg-white/20 text-white" : "bg-background text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {filtered.length === claims.length
            ? `${claims.length} tài sản`
            : `${filtered.length} / ${claims.length} tài sản`}
        </span>
      </div>

      {/* Bulk confirm banner */}
      {pendingInView > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm text-amber-700">
            <strong>{pendingCount}</strong> tài sản đang chờ xác nhận
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={onConfirmAll}
            disabled={isProcessing}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Xác nhận tất cả
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Không tìm thấy tài sản nào
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tài sản</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Giá khởi điểm</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Lần ĐG</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Khớp theo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Trạng thái</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((claim, i) => {
                  const listing    = claim.listing;
                  const title      = listing?.title ?? claim.asset_owner?.name ?? "Tài sản không rõ";
                  const statusCfg  = STATUS_CONFIG[claim.status];
                  const StatusIcon = statusCfg.icon;
                  const roundCount = claim.listing_id ? (roundCountsByListing[claim.listing_id] ?? 0) : 0;

                  return (
                    <tr key={claim.id} className={cn("transition-colors hover:bg-muted/20", i < filtered.length - 1 && "border-b border-border")}>
                      {/* Title + thumbnail */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {listing?.image_url ? (
                            <img src={listing.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-muted" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              onClick={() => claim.listing_id && navigate(`/listings/${claim.listing_id}`)}
                              disabled={!claim.listing_id}
                              className="text-sm font-medium text-foreground hover:text-primary hover:underline text-left line-clamp-2 disabled:cursor-default"
                            >
                              {title}
                            </button>
                            {listing?.property_type_slug && (
                              <span className="inline-block text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full mt-0.5">
                                {listing.property_type_slug}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-foreground whitespace-nowrap hidden md:table-cell">
                        {listing?.price ? formatPrice(listing.price, "TOTAL") : "—"}
                      </td>

                      {/* Lần ĐG */}
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {roundCount > 0 ? (
                          <span className={cn(
                            "inline-block text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums",
                            roundCount >= 3 ? "bg-red-100 text-red-700" :
                            roundCount >= 2 ? "bg-orange-100 text-orange-700" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {roundCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Matched name + confidence */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-1">
                          {claim.matched_name && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{claim.matched_name}</p>
                          )}
                          {claim.confidence_score !== null && (
                            <span className={cn("inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full", CONFIDENCE_CLASS(claim.confidence_score))}>
                              {Math.round(claim.confidence_score * 100)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", statusCfg.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {claim.status === "pending_confirmation" ? (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => onReject(claim.id)}
                              disabled={isProcessing}
                              className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold transition-colors disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                            <button
                              onClick={() => onConfirm(claim.id)}
                              disabled={isProcessing}
                              className="text-xs px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold transition-colors disabled:opacity-50"
                            >
                              Xác nhận
                            </button>
                          </div>
                        ) : claim.listing_id ? (
                          <button
                            onClick={() => navigate(`/listings/${claim.listing_id}`)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            Xem <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link back to claim flow */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate("/tro-thanh-chu-tai-san")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Chạy matching lại / Tìm thêm tài sản
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
