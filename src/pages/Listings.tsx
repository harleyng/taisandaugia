import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuctionCard } from "@/components/AuctionCard";
import { AuctionQuickFilters } from "@/components/AuctionQuickFilters";
import { AuctionFilterDialog } from "@/components/AuctionFilterDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Map, Search, Megaphone, Loader2, LogIn } from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useAuctionListings, getSessionStatus } from "@/hooks/useAuctionListings";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAssetActions } from "@/hooks/useAssetActions";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { formatAddress } from "@/utils/formatters";
import { useSearchParams, Link } from "react-router-dom";
import { type AuctionFilters, defaultAuctionFilters } from "@/types/auction-filters.types";

type SortMode = "newest" | "price-asc" | "price-desc";

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
    <h3 className="font-bold text-lg mb-1">Đăng tin ngay</h3>
    <p className="text-sm opacity-90 mb-4">Ký gửi tài sản đấu giá để tiếp cận hàng nghìn nhà đầu tư</p>
    <Button asChild variant="secondary" size="sm">
      <Link to="/submit-listing">Bắt đầu</Link>
    </Button>
  </div>
);

const Listings = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || searchParams.get("sub") || "";

  const { data: listings, isLoading } = useAuctionListings();
  const { openAuthDialog } = useAuthDialog();
  const { savedIds, toggleSave } = useAssetActions();
  const [session, setSession] = useState<any>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

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
        const dep = (l.custom_attributes as any)?.deposit_amount;
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
        const ca = l.custom_attributes as any;
        const ed = ca?.enforcement_decision?.toLowerCase() || "";
        const lc = ca?.legal_category?.toLowerCase() || "";
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
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [listings, filters, sortMode]);

  const isGuest = !session;
  const maxVisible = isGuest ? Math.min(visibleCount, GUEST_VISIBLE_ITEMS) : visibleCount;
  const visibleListings = filteredListings.slice(0, maxVisible);
  const hasMore = !isGuest && visibleCount < filteredListings.length;
  const showLoginGate = isGuest && filteredListings.length > GUEST_VISIBLE_ITEMS;

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
        <div className="mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Danh Sách Tài Sản Đấu Giá</h1>
          <p className="text-muted-foreground mt-1">
            Tìm thấy <span className="font-semibold text-foreground">{filteredListings.length}</span> tài sản
          </p>
        </div>

        {/* Quick Filters + Sort bar */}
        <div className="flex items-center justify-between gap-3 mb-4 sticky top-16 z-10 bg-background/80 backdrop-blur-sm py-2 -mt-2 overflow-x-auto">
          <AuctionQuickFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onOpenAdvanced={() => setAdvancedOpen(true)}
          />
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-[180px] shrink-0 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mới nhất</SelectItem>
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

                  items.push(
                    <AuctionCard
                      key={listing.id}
                      id={listing.id}
                      imageUrl={listing.image_url}
                      title={listing.title}
                      address={formatAddress(listing.address) || "Chưa cập nhật"}
                      startingPrice={listing.price}
                      stepPrice={ca.bid_step ?? ca.step_price}
                      depositAmount={ca.deposit_amount}
                      auctionDate={ca.auction_date ?? ca.auction_time}
                      registrationDeadline={ca.registration_deadline ?? ca.document_sale_end}
                      sessionStatus={listing._sessionStatus}
                      categorySlug={listing.property_type_slug}
                      viewMode="grid"
                      winPrice={ca.win_price ?? ca.winning_price}
                      orgName={ca.org_name}
                      isSaved={savedIds.has(listing.id)}
                      onToggleSave={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(listing.id); }}
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
