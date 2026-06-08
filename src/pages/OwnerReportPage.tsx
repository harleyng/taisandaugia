import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, SlidersHorizontal, X, ChevronDown, ChevronUp,
  FileBarChart2, Lock, Coins, ArrowUpDown, Check, ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { formatPrice, formatDate } from "@/utils/formatters";

const DIST_PALETTE = [
  "hsl(250 60% 60%)",
  "hsl(170 60% 42%)",
  "hsl(35 85% 55%)",
  "hsl(340 65% 55%)",
  "hsl(195 65% 50%)",
  "hsl(100 50% 45%)",
];

const SLUG_DISPLAY: Record<string, string> = {};
for (const cat of ASSET_CATEGORIES) {
  SLUG_DISPLAY[cat.slug] = cat.name;
  for (const child of cat.children) SLUG_DISPLAY[child.slug] = child.name;
}

const STATUS_LABELS = ["Chờ đấu", "Đã thành", "Tồn đọng", "Không thành", "Đang đấu"];
import { useOwnerPortfolioMetrics, type PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";
import { useOwnerReportAccess } from "@/hooks/useOwnerReportAccess";
import { useCredits } from "@/hooks/useCredits";
import { OWNER_REPORT_COST } from "@/lib/credits";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const TIME_PRESETS = [
  { label: "30 ngày", days: 30 },
  { label: "60 ngày", days: 60 },
  { label: "90 ngày", days: 90 },
  { label: "1 năm", days: 365 },
  { label: "Tất cả", days: null as null | number },
] as const;

function activePreset(filter: PortfolioFilter): string {
  if (!filter.dateFrom) return "Tất cả";
  for (const p of TIME_PRESETS) {
    if (p.days && filter.dateFrom === daysAgo(p.days) && !filter.dateTo) return p.label;
  }
  return "";
}

function filterSummary(filter: PortfolioFilter): string {
  const parts: string[] = [];
  if (filter.propertyTypeSlugs?.length)
    parts.push(filter.propertyTypeSlugs.map((s) => SLUG_DISPLAY[s] ?? s).join(", "));
  if (filter.provinces?.length) parts.push(filter.provinces.join(", "));
  if (filter.auctionOrgIds?.length) parts.push(`${filter.auctionOrgIds.length} tổ chức`);
  if (filter.statusLabels?.length) parts.push(filter.statusLabels.join(", "));
  if (filter.legalStatuses?.length) parts.push(filter.legalStatuses.join(", "));
  return parts.join(" · ") || "Toàn danh mục";
}

function isDefaultFilter(filter: PortfolioFilter): boolean {
  return (
    !filter.propertyTypeSlugs?.length &&
    !filter.provinces?.length &&
    !filter.auctionOrgIds?.length &&
    !filter.statusLabels?.length &&
    !filter.legalStatuses?.length &&
    !filter.dateFrom &&
    !filter.dateTo
  );
}

// ─── ChartCard ───────────────────────────────────────────────────────────────

function ChartCard({
  title, sub, tag, n, children, empty, className,
}: {
  title: string;
  sub?: string;
  tag?: string;
  n?: string;
  children: React.ReactNode;
  empty?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("bg-card border border-border rounded-xl overflow-hidden shadow-sm", className)}>
      <div className="px-5 py-3.5 border-b border-border flex items-start justify-between gap-4">
        <div>
          <h4 className="font-serif font-semibold text-sm flex items-center gap-2 flex-wrap">
            {title}
            {tag && (
              <span className="font-mono text-[9px] bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground uppercase tracking-wider font-semibold">
                {tag}
              </span>
            )}
          </h4>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {n && <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">{n}</span>}
      </div>
      <div className="px-5 py-4">
        {empty ? (
          <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground gap-2">
            <Lock className="h-3.5 w-3.5" />
            Chưa có dữ liệu
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ─── Chip / SegBtn ────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-md text-xs font-medium border transition-all select-none whitespace-nowrap",
        active
          ? "bg-primary/10 border-primary text-primary font-semibold"
          : "bg-background border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function SegBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-xs font-medium border-r border-border last:border-r-0 transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground font-semibold"
          : "bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

// ─── MultiSelectPopover ──────────────────────────────────────────────────────

function MultiSelectPopover({
  options, selected, onChange, placeholder,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };
  const label = selected.length === 0
    ? placeholder
    : selected.length <= 2
    ? selected.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ")
    : `${selected.length} đã chọn`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-colors text-left min-w-[180px]",
            selected.length > 0
              ? "bg-primary/10 border-primary text-primary"
              : "bg-background border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
          )}
        >
          <span className="truncate flex-1">{label}</span>
          <div className="flex items-center gap-1 shrink-0">
            {selected.length > 0 && (
              <span
                className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
              >
                <X className="h-2.5 w-2.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Tìm ${placeholder.toLowerCase()}…`} className="text-xs" />
          <CommandList className="max-h-56">
            <CommandEmpty className="text-xs text-muted-foreground py-3 text-center">
              Không tìm thấy.
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => toggle(opt.value)}
                  className="text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0 text-primary",
                    selected.includes(opt.value) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const OwnerReportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PortfolioFilter>({});
  const [advOpen, setAdvOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const prevFilterRef = useRef<string>("{}");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      supabase
        .from("asset_owner_workspaces")
        .select("id")
        .eq("owner_user_id", session.user.id)
        .maybeSingle()
        .then(({ data: ws }) => {
          setWorkspaceId(ws?.id ?? null);
          setLoading(false);
        });
    });
  }, []);

  const { metrics, isLoading: metricsLoading } = useOwnerPortfolioMetrics(workspaceId, filter);
  const { metrics: allMetrics } = useOwnerPortfolioMetrics(workspaceId, {});
  const { charge } = useOwnerReportAccess(workspaceId ?? "");
  const { balance } = useCredits();

  // ── filter helpers ─────────────────────────────────────────────────────────
  const toggleSlug = (val: string) => {
    const arr = filter.propertyTypeSlugs ?? [];
    const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
    setFilter({ ...filter, propertyTypeSlugs: next.length ? next : undefined });
  };

  const toggleStatus = (val: string) => {
    const arr = filter.statusLabels ?? [];
    const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
    setFilter({ ...filter, statusLabels: next.length ? next : undefined });
  };

  const setPreset = (days: number | null) => {
    setFilter({ ...filter, dateFrom: days ? daysAgo(days) : undefined, dateTo: undefined });
  };

  // Reset unlock whenever filter changes
  useEffect(() => {
    const key = JSON.stringify(filter);
    if (key !== prevFilterRef.current) {
      prevFilterRef.current = key;
      setUnlocked(false);
    }
  }, [filter]);

  const cost = isDefaultFilter(filter) ? 0 : OWNER_REPORT_COST;

  const handleUnlock = () => {
    if (cost === 0) {
      charge.mutate({ filter, isDefault: true }, {
        onSuccess: () => setUnlocked(true),
        onError: () => setUnlocked(true), // free — still unlock even if logging fails
      });
    } else {
      setConfirmOpen(true);
    }
  };

  const handleConfirm = () => {
    charge.mutate({ filter, isDefault: false }, {
      onSuccess: (result) => {
        setConfirmOpen(false);
        if (result.ok) {
          setUnlocked(true);
        } else {
          toast.error("Không đủ tín dụng. Vui lòng nạp thêm.");
        }
      },
      onError: () => {
        setConfirmOpen(false);
        toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
      },
    });
  };

  const preset = activePreset(filter);
  const isDefault = isDefaultFilter(filter);
  const label = filterSummary(filter);

  // ── insight text ───────────────────────────────────────────────────────────
  const insightText = (() => {
    if (metricsLoading || metrics.totalAssets === 0) return null;
    const parts: string[] = [];
    parts.push(`**${metrics.totalAssets} tài sản**`);
    if (!isDefault) parts.push(`khớp tiêu chí — ${label}`);
    parts.push(".");
    if (metrics.byOrg.length > 0) {
      const top = metrics.byOrg[0];
      parts.push(` Phần lớn qua **${top.name}** (${top.pct}%).`);
    }
    if (metrics.successRate > 0) {
      parts.push(` Tỷ lệ thành công **${metrics.successRate}%**.`);
    }
    if (metrics.pendingCount > 0) {
      parts.push(` **${metrics.pendingCount}** tài sản tồn đọng cần theo dõi.`);
    }
    return parts.join("");
  })();

  // ── sortable listings table ────────────────────────────────────────────────
  type SortKey = "upcoming" | "price_desc" | "rounds_desc";
  const [sortBy, setSortBy] = useState<SortKey>("upcoming");

  const sortedListings = useMemo(() => {
    const rows = [...metrics.allListings];
    const nowIso = new Date().toISOString();
    if (sortBy === "upcoming") {
      return rows.sort((a, b) => {
        const af = a.auctionTime && a.auctionTime > nowIso;
        const bf = b.auctionTime && b.auctionTime > nowIso;
        if (af && !bf) return -1;
        if (!af && bf) return 1;
        if (af && bf) return a.auctionTime!.localeCompare(b.auctionTime!);
        return 0;
      });
    }
    if (sortBy === "price_desc") return rows.sort((a, b) => b.price - a.price);
    if (sortBy === "rounds_desc") return rows.sort((a, b) => b.roundCount - a.roundCount);
    return rows;
  }, [metrics.allListings, sortBy]);

  const maxOrg = metrics.byOrg[0]?.count ?? 1;
  const chartCount = [
    metrics.priceByMonth.length >= 3,
    metrics.byOrg.length > 0,
    metrics.byPropertyType.length > 0,
    metrics.byLegalStatus.length > 0,
    metrics.byProvince.length > 0,
    metrics.byBranch.length > 0,
  ].filter(Boolean).length;

  // ── guards ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <div className="text-center space-y-4 max-w-sm">
          <div className="p-3 rounded-xl bg-primary/10 w-fit mx-auto">
            <FileBarChart2 className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Bạn chưa có workspace Chủ tài sản.</p>
          <Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Bắt đầu KYC</Button>
        </div>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-serif">Báo cáo Danh mục Tài sản</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Theo dõi diễn biến, phân tích hiệu suất và lịch đấu giá trong danh mục của bạn.
        </p>
      </div>

      {/* ── Filter card ─── */}
      <div className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Tiêu chí danh mục</span>
          </div>
          {!isDefault && (
            <button
              type="button"
              onClick={() => setFilter({})}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Đặt lại
            </button>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Row 1: Asset types — chips with display name */}
          {allMetrics.availablePropertyTypes.length > 0 && (
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Loại tài sản
                {filter.propertyTypeSlugs?.length ? ` · ${filter.propertyTypeSlugs.length} chọn` : " · tất cả"}
              </p>
              <div className="flex flex-wrap gap-2">
                {allMetrics.availablePropertyTypes.map((t) => (
                  <Chip
                    key={t}
                    label={SLUG_DISPLAY[t] ?? t}
                    active={(filter.propertyTypeSlugs ?? []).includes(t)}
                    onClick={() => toggleSlug(t)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Row 2: Time period */}
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Thời gian đấu giá
            </p>
            <div className="inline-flex border border-border rounded-md overflow-hidden">
              {TIME_PRESETS.map((p) => (
                <SegBtn
                  key={p.label}
                  label={p.label}
                  active={preset === p.label}
                  onClick={() => setPreset(p.days)}
                />
              ))}
            </div>
          </div>

          {/* Advanced filters — collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setAdvOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {(filter.provinces?.length ?? 0) + (filter.auctionOrgIds?.length ?? 0) +
               (filter.statusLabels?.length ?? 0) + (filter.legalStatuses?.length ?? 0) > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 flex items-center justify-center">
                  {(filter.provinces?.length ?? 0) + (filter.auctionOrgIds?.length ?? 0) +
                   (filter.statusLabels?.length ?? 0) + (filter.legalStatuses?.length ?? 0)}
                </span>
              )}
              Lọc nâng cao
              {advOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {advOpen && (
              <div className="mt-3 pt-3 border-t border-border space-y-3">
                {/* Tỉnh / Thành phố */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-24 shrink-0">
                    Tỉnh / TP
                  </span>
                  <MultiSelectPopover
                    options={allMetrics.availableProvinces.map((p) => ({ value: p, label: p }))}
                    selected={filter.provinces ?? []}
                    onChange={(v) => setFilter({ ...filter, provinces: v.length ? v : undefined })}
                    placeholder="Tỉnh / Thành phố"
                  />
                </div>

                {/* Tổ chức đấu giá */}
                {allMetrics.availableOrgIds.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-24 shrink-0">
                      TCDG
                    </span>
                    <MultiSelectPopover
                      options={allMetrics.availableOrgIds.map((o) => ({ value: o.id, label: o.name }))}
                      selected={filter.auctionOrgIds ?? []}
                      onChange={(v) => setFilter({ ...filter, auctionOrgIds: v.length ? v : undefined })}
                      placeholder="Tổ chức đấu giá"
                    />
                  </div>
                )}

                {/* Trạng thái tài sản */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-24 shrink-0">
                    Trạng thái
                  </span>
                  <MultiSelectPopover
                    options={STATUS_LABELS.map((s) => ({ value: s, label: s }))}
                    selected={filter.statusLabels ?? []}
                    onChange={(v) => setFilter({ ...filter, statusLabels: v.length ? v : undefined })}
                    placeholder="Trạng thái tài sản"
                  />
                </div>

                {/* Pháp lý */}
                {allMetrics.availableLegalStatuses.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-24 shrink-0">
                      Pháp lý
                    </span>
                    <MultiSelectPopover
                      options={allMetrics.availableLegalStatuses.map((s) => ({ value: s, label: s }))}
                      selected={filter.legalStatuses ?? []}
                      onChange={(v) => setFilter({ ...filter, legalStatuses: v.length ? v : undefined })}
                      placeholder="Danh mục pháp lý"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Locked / unlock banner ─── */}
      {!unlocked && (
        <div className="bg-[#1a2e1f] text-white rounded-xl px-6 py-5 flex items-center justify-between gap-6 flex-wrap shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0">
              <Lock className="h-4 w-4 text-white/80" />
            </div>
            <div>
              <p className="font-semibold text-white text-[15px] leading-snug">
                Báo cáo đang khoá
              </p>
              <p className="text-[12.5px] text-green-300/80 mt-0.5">
                {cost === 0
                  ? "Xem toàn bộ danh mục — miễn phí"
                  : `Bộ lọc tùy chỉnh · ${cost} tín dụng / lần xem`}
              </p>
            </div>
          </div>
          <button
            onClick={handleUnlock}
            disabled={charge.isPending}
            className="bg-yellow-300 hover:bg-yellow-200 disabled:opacity-60 text-yellow-950 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors flex-shrink-0 whitespace-nowrap flex items-center gap-2"
          >
            {charge.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {cost === 0 ? "Xem báo cáo →" : `Mở khoá báo cáo · ⊛${cost}`}
          </button>
        </div>
      )}

      {/* ── Insight banner + report ─── */}
      {unlocked && insightText && (
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-2">
            ★ Insight chính
          </p>
          <p className="font-serif text-base leading-relaxed text-foreground">
            {insightText.split(/\*\*(.+?)\*\*/).map((part, i) =>
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
            )}
          </p>
        </div>
      )}

      {/* ── KPI + Charts + Schedule (only when unlocked) ─── */}
      {unlocked && (metricsLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Tổng tài sản", value: metrics.totalAssets.toString(), sub: "trong danh mục" },
              { label: "Tổng giá KĐ", value: metrics.totalStartingPriceLabel, sub: "giá khởi điểm tích lũy" },
              { label: "Tỷ lệ thành công", value: `${metrics.successRate}%`, sub: "tài sản đấu thành" },
              { label: "Đang tồn đọng", value: metrics.pendingCount.toString(), sub: "tài sản ≥ 2 vòng" },
            ].map(({ label: l, value, sub }) => (
              <div key={l} className="bg-card border border-border rounded-xl px-5 py-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {l}
                </p>
                <p className="font-serif text-2xl font-bold text-foreground mt-1">{value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* ── Charts grid ─── */}
          {chartCount > 0 && (
            <div className="space-y-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-3 after:flex-1 after:h-px after:bg-border">
                Phân tích danh mục · {chartCount} biểu đồ
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chart 1: Price trend */}
                <ChartCard
                  title="Diễn biến giá khởi điểm"
                  sub="Giá KĐ trung bình theo tháng"
                  tag="#1"
                  n={`n = ${metrics.priceByMonth.length}`}
                  empty={metrics.priceByMonth.length < 3}
                >
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics.priceByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v: number) => `${(v / 1_000_000_000).toFixed(0)}B`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number) => formatPrice(v, "TOTAL")}
                        />
                        <Line
                          type="monotone"
                          dataKey="avgPrice"
                          name="Giá KĐ TB"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                {/* Chart 2: By org bar list */}
                <ChartCard
                  title="Phân bố theo tổ chức đấu giá"
                  sub="Số tài sản theo TCDG"
                  tag="#2"
                  n={`n = ${metrics.totalAssets}`}
                  empty={metrics.byOrg.length === 0}
                >
                  <div className="flex flex-col gap-2.5">
                    {metrics.byOrg.slice(0, 6).map((o, i) => (
                      <div key={o.name} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 1fr 36px" }}>
                        <span className="text-xs text-muted-foreground font-medium truncate">{o.name}</span>
                        <div className="h-5 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${(o.count / maxOrg) * 100}%`,
                              background: i === 0
                                ? "hsl(var(--accent))"
                                : "linear-gradient(90deg, hsl(var(--primary)/0.8), hsl(var(--primary)/0.5))",
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-right">{o.count}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>

                {/* Chart 3: By property type — Donut */}
                <ChartCard
                  title="Phân bổ theo loại tài sản"
                  sub="Tỷ lệ theo từng danh mục"
                  tag="#3"
                  n={`n = ${metrics.totalAssets}`}
                  empty={metrics.byPropertyType.length === 0}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-[120px] h-[120px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={metrics.byPropertyType} cx="50%" cy="50%"
                            innerRadius={32} outerRadius={55} paddingAngle={2} dataKey="count">
                            {metrics.byPropertyType.map((_, i) => (
                              <Cell key={i} fill={DIST_PALETTE[i % DIST_PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => `${v} tài sản`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      {metrics.byPropertyType.slice(0, 6).map((d, i) => (
                        <div key={d.label} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DIST_PALETTE[i % DIST_PALETTE.length] }} />
                            <span className="text-xs text-foreground truncate">{d.label}</span>
                          </div>
                          <span className="font-mono text-xs font-semibold shrink-0">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartCard>

                {/* Chart 4: By legal status — Donut */}
                <ChartCard
                  title="Phân bổ theo pháp lý"
                  sub="Tỷ lệ theo từng tình trạng pháp lý"
                  tag="#4"
                  n={`n = ${metrics.totalAssets}`}
                  empty={metrics.byLegalStatus.length === 0}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-[120px] h-[120px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={metrics.byLegalStatus} cx="50%" cy="50%"
                            innerRadius={32} outerRadius={55} paddingAngle={2} dataKey="count">
                            {metrics.byLegalStatus.map((_, i) => (
                              <Cell key={i} fill={DIST_PALETTE[i % DIST_PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => `${v} tài sản`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      {metrics.byLegalStatus.slice(0, 6).map((d, i) => (
                        <div key={d.label} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DIST_PALETTE[i % DIST_PALETTE.length] }} />
                            <span className="text-xs text-foreground truncate">{d.label}</span>
                          </div>
                          <span className="font-mono text-xs font-semibold shrink-0">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartCard>

                {/* Chart 5: By province — Recharts horizontal bar, full-width */}
                <ChartCard
                  title="Phân bổ theo địa điểm"
                  sub="Số tài sản theo tỉnh / thành phố"
                  tag="#5"
                  n={`n = ${metrics.totalAssets}`}
                  empty={metrics.byProvince.length === 0}
                  className="md:col-span-2"
                >
                  <ResponsiveContainer width="100%" height={metrics.byProvince.slice(0, 10).length * 36 + 8}>
                    <BarChart
                      layout="vertical"
                      data={metrics.byProvince.slice(0, 10)}
                      margin={{ left: 8, right: 40, top: 0, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={130}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Bar dataKey="count" radius={4} maxBarSize={20} label={{ position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}>
                        {metrics.byProvince.slice(0, 10).map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "hsl(var(--accent))" : "hsl(var(--primary) / 0.65)"} />
                        ))}
                      </Bar>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`${v} tài sản`]}
                        cursor={{ fill: "hsl(var(--muted))" }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Chart 6: By branch — Segmented band, full-width */}
                <ChartCard
                  title="Phân bổ theo chi nhánh"
                  sub="Tỷ lệ tài sản theo từng chi nhánh / đơn vị"
                  tag="#6"
                  n={`n = ${metrics.totalAssets}`}
                  empty={metrics.byBranch.length === 0}
                  className="md:col-span-2"
                >
                  <div className="space-y-4">
                    <div className="flex h-7 rounded-lg overflow-hidden gap-px">
                      {metrics.byBranch.slice(0, 6).map((b, i) => (
                        <div
                          key={b.label}
                          style={{
                            width: `${b.pct}%`,
                            background: DIST_PALETTE[i % DIST_PALETTE.length],
                            minWidth: "2%",
                          }}
                          title={`${b.label}: ${b.count} (${b.pct}%)`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {metrics.byBranch.slice(0, 6).map((b, i) => (
                        <div key={b.label} className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DIST_PALETTE[i % DIST_PALETTE.length] }} />
                          <span className="text-xs text-muted-foreground truncate max-w-[140px]">{b.label}</span>
                          <span className="font-mono text-[10px] font-bold text-foreground">{b.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {/* ── Sortable listings table ─── */}
          {sortedListings.length > 0 && (
            <div className="space-y-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-3 after:flex-1 after:h-px after:bg-border">
                Danh sách đấu giá tiêu biểu · {sortedListings.length} tài sản
              </p>

              {/* Sort controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {([
                  { key: "upcoming",    label: "Sắp diễn ra" },
                  { key: "price_desc",  label: "Giá KĐ cao nhất" },
                  { key: "rounds_desc", label: "Đấu lại nhiều nhất" },
                ] as { key: SortKey; label: string }[]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSortBy(opt.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                      sortBy === opt.key
                        ? "bg-primary/10 border-primary text-primary font-semibold"
                        : "bg-background border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                {/* Header */}
                <div className="grid px-5 py-2.5 border-b border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  style={{ gridTemplateColumns: "1fr 120px 110px 80px 72px" }}>
                  <span>Tài sản</span>
                  <span className="text-right">Giá KĐ</span>
                  <span className="text-center">Phiên đấu</span>
                  <span className="text-center">Vòng</span>
                  <span className="text-center">Trạng thái</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/50">
                  {sortedListings.slice(0, 20).map((l) => {
                    const nowIso = new Date().toISOString();
                    const isFuture = l.auctionTime && l.auctionTime > nowIso;
                    const isSold = l.listingStatus === "SOLD_RENTED" || !!l.winPrice;
                    const isPending = !isSold && l.sessionStatus === "ended" && l.roundCount >= 2;
                    const statusLabel = isSold ? "Đã thành"
                      : l.sessionStatus === "registration_open" ? "Đăng ký"
                      : l.sessionStatus === "upcoming" ? "Sắp đấu"
                      : l.sessionStatus === "ongoing" ? "Đang đấu"
                      : isPending ? "Tồn đọng"
                      : "Không thành";
                    const statusColor = isSold ? "text-[hsl(142,76%,36%)] bg-[hsl(142,76%,36%)]/10"
                      : l.sessionStatus === "registration_open" || l.sessionStatus === "upcoming" ? "text-primary bg-primary/10"
                      : l.sessionStatus === "ongoing" ? "text-[hsl(38,92%,50%)] bg-[hsl(38,92%,50%)]/10"
                      : isPending ? "text-[hsl(25,95%,53%)] bg-[hsl(25,95%,53%)]/10"
                      : "text-muted-foreground bg-muted";

                    return (
                      <div
                        key={l.id}
                        className="grid px-5 py-3 items-center hover:bg-muted/30 transition-colors"
                        style={{ gridTemplateColumns: "1fr 120px 110px 80px 72px" }}
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-xs font-medium text-foreground line-clamp-1">{l.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {l.province}{l.auctionOrgName ? ` · ${l.auctionOrgName}` : ""}
                          </p>
                        </div>
                        <p className="font-mono text-xs font-semibold text-right tabular-nums">
                          {formatPrice(l.price, l.priceUnit)}
                        </p>
                        <p className="text-[10px] text-muted-foreground text-center">
                          {l.auctionTime
                            ? <span className={isFuture ? "text-primary font-medium" : ""}>{formatDate(l.auctionTime)}</span>
                            : "—"}
                        </p>
                        <p className="font-mono text-xs text-center tabular-nums">
                          {l.roundCount > 0 ? (
                            <span className={l.roundCount >= 2 ? "font-semibold text-[hsl(25,95%,53%)]" : ""}>
                              {l.roundCount}×
                            </span>
                          ) : "—"}
                        </p>
                        <div className="flex justify-center">
                          <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap", statusColor)}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {sortedListings.length > 20 && (
                  <div className="px-5 py-2.5 border-t border-border text-[10px] text-muted-foreground text-center bg-muted/20">
                    Hiển thị 20 / {sortedListings.length} tài sản
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ))}

      {/* ── Confirm dialog (paid reports) ─── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-sm">
          <div className="bg-gradient-to-br from-[#1f3a2a] to-[#15291d] text-white px-6 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Coins className="h-5 w-5 text-yellow-950" />
            </div>
            <h3 className="text-lg font-semibold text-white font-serif">Xác nhận mở khoá báo cáo</h3>
            <p className="text-xs text-green-300 mt-1">Phân tích riêng theo tiêu chí của bạn</p>
          </div>
          <div className="px-6 py-5">
            <div className="divide-y divide-border">
              <div className="flex justify-between py-2.5 text-sm">
                <span className="text-muted-foreground">Bộ lọc</span>
                <span className="font-medium text-foreground truncate max-w-[180px] text-right">{label}</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm">
                <span className="text-muted-foreground">Chi phí</span>
                <span className="font-mono font-semibold">⊛{cost} tín dụng</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm">
                <span className="text-muted-foreground">Số dư của bạn</span>
                <span className={cn("font-mono font-semibold", balance < cost ? "text-destructive" : "text-foreground")}>
                  ⊛{balance}
                </span>
              </div>
            </div>
            {balance < cost && (
              <p className="text-xs text-destructive mt-3">
                Không đủ tín dụng. Vui lòng nạp thêm để tiếp tục.
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted transition-colors"
              >
                Để sau
              </button>
              <button
                onClick={handleConfirm}
                disabled={charge.isPending || balance < cost}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {charge.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Mở khoá · ⊛{cost}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerReportPage;
