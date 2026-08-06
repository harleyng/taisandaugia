import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuctionCard } from "@/components/AuctionCard";
import { AuctionQuickFilters } from "@/components/AuctionQuickFilters";
import { AuctionFilterDialog } from "@/components/AuctionFilterDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Map, Search, Megaphone, Loader2, LogIn, FileText, Coins, Building2, RefreshCw } from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useAuctionListings, getSessionStatus } from "@/hooks/useAuctionListings";
import { caNumber, caRecordArray, caString } from "@/types/listing";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAssetActions } from "@/hooks/useAssetActions";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { formatAddress } from "@/utils/formatters";
import { useSearchParams, Link } from "react-router-dom";
import { type AuctionFilters, defaultAuctionFilters } from "@/types/auction-filters.types";
import { useListingSaveCounts } from "@/hooks/useListingSaveCounts";
import { useAuctionOrgNames } from "@/hooks/useAuctionOrgNames";
import { useQuery } from "@tanstack/react-query";
import { useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { useDemandSubscription } from "@/hooks/useDemandSubscription";
import { useAuthState } from "@/hooks/useAuthState";
import { countMatches, hasIntent } from "@/lib/demandMatch";
import { DemandUpsellBanner } from "@/components/demand/DemandUpsellBanner";
import { DemandEmptyMatch } from "@/components/demand/DemandEmptyMatch";
import { DemandStatusBadge } from "@/components/demand/DemandStatusBadge";
import { qk } from "@/lib/queryKeys";

type SortMode = "newest" | "price-asc" | "price-desc" | "upcoming";

const ITEMS_PER_PAGE = 30;
const GUEST_VISIBLE_ITEMS = 11;

const categoryParentMap: Record<string, string> = {};
ASSET_CATEGORIES.forEach((c) => {
  c.children.forEach((ch) => {
    categoryParentMap[ch.slug] = c.slug;
  });
});

function matchesCategory(listingSlug: string, filterSlug: string): boolean {
  if (!filterSlug || filterSlug === "all") return true;
  if (listingSlug === filterSlug) return true;
  const parent = ASSET_CATEGORIES.find((c) => c.slug === filterSlug);
  if (parent) return parent.children.some((ch) => ch.slug === listingSlug);
  return false;
}

const CtaCard = () => (
  <div className="rounded-lg bg-gradient-to-br from-primary to-primary/80 p-5 flex flex-col items-center justify-center text-center text-primary-foreground h-full min-h-[280px]">
    <Megaphone className="h-10 w-10 mb-3 opacity-90" />
    <h3 className="font-bold text-lg mb-1">Liên hệ hợp tác</h3>
    <p className="text-sm opacity-90 mb-4">Hợp tác đăng tài sản đấu giá để tiếp cận hàng nghìn nhà đầu tư</p>
    <Button asChild variant="secondary" size="sm">
      <Link to="/listings">Xem thêm</Link>
    </Button>
  </div>
);

const Listings = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || searchParams.get("sub") || "";

  const { data: listings, isLoading } = useAuctionListings();
  const listingIds = useMemo(() => (listings || []).map((l) => l.id), [listings]);
  const listingOrgIds = useMemo(() => (listings || []).map((l) => l.auction_org_id), [listings]);
  const saveCounts = useListingSaveCounts(listingIds);
  const orgNameById = useAuctionOrgNames(listingOrgIds);
  const { openAuthDialog } = useAuthDialog();
  const { savedIds, toggleSave } = useAssetActions();
  const { agentInfo } = useOnboardingTasks();
  const { status: demandStatus } = useDemandSubscription();
  const intent = agentInfo?.intent ?? null;
  const userHasIntent = hasIntent(intent);
  const { session } = useAuthState();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: allCompanies = [] } = useQuery({
    queryKey: qk.auctionOrganizationsList,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });


  const [filters, setFilters] = useState<AuctionFilters>({
    ...defaultAuctionFilters,
    category: initialCategory,
  });
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const filteredListings = useMemo(() => {
    if (!listings) return [];

    let result = listings.map((l) => ({
      ...l,
      _sessionStatus: getSessionStatus(l),
    }));

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter((l) => {
        const ca = l.custom_attributes || {};
        return (
          l.title.toLowerCase().includes(q) ||
          (l.address && JSON.stringify(l.address).toLowerCase().includes(q)) ||
          (ca.session_code && String(ca.session_code).toLowerCase().includes(q)) ||
          (ca.enforcement_decision && String(ca.enforcement_decision).toLowerCase().includes(q))
        );
      });
    }

    if (filters.province) {
      result = result.filter((l) => l.address?.province === filters.province);
    }

    if (filters.district) {
      result = result.filter((l) => l.address?.district === filters.district);
    }

    if (filters.category) {
      result = result.filter((l) => matchesCategory(l.property_type_slug, filters.category));
    }

    if (filters.priceMin) {
      const min = Number(filters.priceMin);
      result = result.filter((l) => l.price >= min);
    }
    if (filters.priceMax) {
      const max = Number(filters.priceMax);
      result = result.filter((l) => l.price <= max);
    }

    if (filters.depositMin || filters.depositMax) {
      const dMin = filters.depositMin ? Number(filters.depositMin) : 0;
      const dMax = filters.depositMax ? Number(filters.depositMax) : Infinity;
      result = result.filter((l) => {
        const dep = caNumber(l.custom_attributes?.deposit_amount);
        if (dep == null) return false;
        return dep >= dMin && dep <= dMax;
      });
    }

    if (filters.publishDateFrom) {
      const from = filters.publishDateFrom.getTime();
      result = result.filter((l) => new Date(l.created_at).getTime() >= from);
    }
    if (filters.publishDateTo) {
      const to = filters.publishDateTo.getTime() + 86400000; // end of day
      result = result.filter((l) => new Date(l.created_at).getTime() <= to);
    }

    if (filters.sessionStatus) {
      result = result.filter((l) => l._sessionStatus === filters.sessionStatus);
    }

    if (filters.legalCategory) {
      result = result.filter((l) => {
        const ca = l.custom_attributes;
        const ed = caString(ca?.enforcement_decision)?.toLowerCase() || "";
        const lc = caString(ca?.legal_category)?.toLowerCase() || "";
        const filterVal = filters.legalCategory;
        if (filterVal === "thi-hanh-an") return ed.includes("thi hành án") || lc.includes("thi hành án");
        if (filterVal === "no-xau") return ed.includes("nợ xấu") || lc.includes("nợ xấu") || ed.includes("vamc") || lc.includes("vamc");
        if (filterVal === "thanh-ly") return ed.includes("thanh lý") || lc.includes("thanh lý");
        if (filterVal === "pha-san") return ed.includes("phá sản") || lc.includes("phá sản");
        return true; // "khac"
      });
    }

    result.sort((a, b) => {
      if (sortMode === "price-asc") return a.price - b.price;
      if (sortMode === "price-desc") return b.price - a.price;
      if (sortMode === "upcoming") {
        const aTime = caString(a.custom_attributes?.auction_time ?? a.custom_attributes?.auction_date);
        const bTime = caString(b.custom_attributes?.auction_time ?? b.custom_attributes?.auction_date);
        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [listings, filters, sortMode]);

  const searchStats = useMemo(() => {
    const count = filteredListings.length;
    const totalValue = filteredListings.reduce((sum, l) => sum + (l.price || 0), 0);
    const uniqueOrgs = new Set(filteredListings.map((l) => l.auction_org_id).filter(Boolean)).size;
    return { count, totalValue, uniqueOrgs };
  }, [filteredListings]);

  const lastUpdated = useMemo(() => {
    if (!listings || listings.length === 0) return null;
    const max = listings.reduce((latest, l) => {
      const t = new Date(l.updated_at || l.created_at).getTime();
      return t > latest ? t : latest;
    }, 0);
    return max ? new Date(max) : null;
  }, [listings]);

  const isGuest = !session;
  const maxVisible = isGuest ? Math.min(visibleCount, GUEST_VISIBLE_ITEMS) : visibleCount;
  const visibleListings = filteredListings.slice(0, maxVisible);
  const hasMore = !isGuest && visibleCount < filteredListings.length;
  const showLoginGate = isGuest && filteredListings.length > GUEST_VISIBLE_ITEMS;

  const searchSuggestions = useMemo(() => {
    if (!listings) return [];
    const seen = new Set<string>();
    const results: string[] = [];
    for (const l of listings) {
      const words = l.title.split(/[\s,–-]+/).filter((w) => w.length > 3);
      for (const w of words) {
        const lower = w.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          results.push(w);
        }
        if (results.length >= 100) break;
      }
      if (results.length >= 100) break;
    }
    return results;
  }, [listings]);

  const handleFiltersChange = useCallback((f: AuctionFilters) => {
    setFilters(f);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultAuctionFilters);
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
        }
      },
      { rootMargin: "200px" }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasMore]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="container py-6 flex-1">
        {/* Page Header */}
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Danh sách tài sản đấu giá</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Khám phá hàng ngàn tài sản đấu giá từ các đơn vị uy tín trên toàn quốc
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Cập nhật mới nhất:{" "}
                {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
                {lastUpdated.toLocaleDateString("vi-VN")}
              </p>
            )}
            {session && userHasIntent && demandStatus !== "NOT_SUBSCRIBED" && (
              <DemandStatusBadge />
            )}
          </div>
        </div>

        {/* Search Stats Bar */}
        {!isLoading && (
          <div className="grid grid-cols-3 gap-3 mb-4 border border-border rounded-xl bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kết quả tìm kiếm</p>
                <p className="text-xl font-bold text-foreground leading-tight">
                  {searchStats.count.toLocaleString("vi-VN")}{" "}
                  <span className="text-sm font-normal text-muted-foreground">tài sản</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-x border-border px-4">
              <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tổng giá trị</p>
                <p className="text-xl font-bold text-foreground leading-tight">
                  {searchStats.totalValue >= 1000
                    ? (searchStats.totalValue / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })
                    : searchStats.totalValue.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {searchStats.totalValue >= 1000 ? "nghìn tỷ" : "tỷ đồng"}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Đơn vị đấu giá</p>
                <p className="text-xl font-bold text-foreground leading-tight">
                  {searchStats.uniqueOrgs.toLocaleString("vi-VN")}{" "}
                  <span className="text-sm font-normal text-muted-foreground">công ty</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Filters + Sort bar */}
        <div className="flex items-center justify-between gap-3 mb-4 sticky top-16 z-10 bg-background/80 backdrop-blur-sm py-2 -mt-2 overflow-x-auto">
          <AuctionQuickFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onOpenAdvanced={() => setAdvancedOpen(true)}
            companies={allCompanies}
            suggestions={searchSuggestions}
          />
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-[180px] shrink-0 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mới nhất</SelectItem>
              <SelectItem value="upcoming">Sắp diễn ra</SelectItem>
              <SelectItem value="price-asc">Giá: Thấp → Cao</SelectItem>
              <SelectItem value="price-desc">Giá: Cao → Thấp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Filter Dialog */}
        <AuctionFilterDialog
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          filters={filters}
          onApply={handleFiltersChange}
        />

        {/* Demand upsell banner — Trigger B */}
        {session &&
          userHasIntent &&
          demandStatus === "NOT_SUBSCRIBED" &&
          !isLoading &&
          countMatches(filteredListings, intent) > 0 && (
            <DemandUpsellBanner matchCount={countMatches(filteredListings, intent)} />
          )}

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Đang tải dữ liệu...</p>
          </div>
        ) : visibleListings.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleListings.map((listing, index) => {
                const ca = listing.custom_attributes || {};
                const items = [];

                if (index === 6) {
                  items.push(<CtaCard key="cta" />);
                }

                const fallbackOrgName = listing.auction_org_id ? orgNameById.get(listing.auction_org_id) : "";
                const orgName = caString(ca.org_name) || fallbackOrgName || "";
                // ca.assets là JSONB — thu hẹp qua helper thay vì index thẳng
                // vào `unknown`.
                const firstAsset = caRecordArray(ca.assets)[0];
                const displayTitle =
                  caString(firstAsset?.title) || listing.description || listing.title;

                  items.push(
                    <AuctionCard
                      key={listing.id}
                      id={listing.id}
                      imageUrl={listing.image_url}
                      title={displayTitle}
                      address={formatAddress(listing.address) || "Chưa cập nhật"}
                      startingPrice={listing.price}
                      stepPrice={caNumber(ca.bid_step ?? ca.step_price)}
                      depositAmount={caNumber(ca.deposit_amount)}
                      auctionDate={caString(ca.auction_date ?? ca.auction_time)}
                      registrationDeadline={caString(ca.registration_deadline ?? ca.document_sale_end)}
                      sessionStatus={listing._sessionStatus}
                      categorySlug={listing.property_type_slug}
                      viewMode="grid"
                      winPrice={caNumber(ca.win_price ?? ca.winning_price)}
                      orgName={orgName}
                      orgId={listing.auction_org_id}
                      isSaved={savedIds.has(listing.id)}
                      onToggleSave={toggleSave}
                      saveCount={saveCounts.get(listing.id) || 0}
                      viewsCount={listing.views_count || 0}
                    />
                  );

                return items;
              })}
            </div>

            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {showLoginGate && (
              <div className="text-center py-10 bg-card rounded-lg border border-border mt-4">
                <LogIn className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Đăng nhập để xem thêm</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Còn {filteredListings.length - GUEST_VISIBLE_ITEMS} tài sản khác. Đăng nhập để xem tất cả.
                </p>
                <Button onClick={() => openAuthDialog()}>
                  <LogIn className="mr-2 h-4 w-4" /> Đăng nhập / Đăng ký
                </Button>
              </div>
            )}

            {!hasMore && !showLoginGate && filteredListings.length > ITEMS_PER_PAGE && (
              <p className="text-center text-sm text-muted-foreground py-6">
                Đã hiển thị tất cả {filteredListings.length} tài sản
              </p>
            )}
          </>
        ) : userHasIntent && session ? (
          <DemandEmptyMatch onResetFilters={resetFilters} />
        ) : (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Không tìm thấy tài sản</h3>
            <p className="text-muted-foreground mb-4">Thử điều chỉnh bộ lọc để tìm thấy kết quả phù hợp</p>
            <Button onClick={resetFilters} variant="outline">
              Đặt lại bộ lọc
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export { Listings as default };
