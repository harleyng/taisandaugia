import { useParams, Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuctionCard } from "@/components/AuctionCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, ChevronRight, Search, Gavel, Trophy, Percent, MapPin } from "lucide-react";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { useAssetActions } from "@/hooks/useAssetActions";
import { useListingSaveCounts } from "@/hooks/useListingSaveCounts";
import { NotificationPromptDialog } from "@/components/NotificationPromptDialog";
import { formatAddress } from "@/utils/formatters";

const AssetOwnerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { savedIds, toggleSave, showNotificationPrompt, dismissNotificationPrompt } = useAssetActions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: owner, isLoading: ownerLoading } = useQuery({
    queryKey: ["asset-owner", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owners")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["asset-owner-listings", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("asset_owner_id", id!)
        .in("status", ["ACTIVE", "SOLD_RENTED"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const saveCounts = useListingSaveCounts(listings.map((l) => l.id));

  const enrichedListings = useMemo(() => {
    return listings.map((l) => ({
      ...l,
      _sessionStatus: getSessionStatus(l as any),
    }));
  }, [listings]);

  const stats = useMemo(() => {
    const total = enrichedListings.length;
    const successful = enrichedListings.filter(
      (l) => l.status === "SOLD_RENTED" || (l.custom_attributes as any)?.win_price
    ).length;
    const rate = total > 0 ? Math.round((successful / total) * 100) : 0;
    return { total, successful, rate };
  }, [enrichedListings]);

  const filtered = useMemo(() => {
    let result = enrichedListings;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => l.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter((l) => l._sessionStatus === statusFilter);
    }
    return result;
  }, [enrichedListings, searchQuery, statusFilter]);

  const isLoading = ownerLoading || listingsLoading;

  if (!id) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <NotificationPromptDialog open={showNotificationPrompt} onClose={dismissNotificationPrompt} />

      <main className="container px-4 py-6 flex-1">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">Trang chủ</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/listings" className="hover:text-foreground transition-colors">Danh sách</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate max-w-[250px]">
            {owner?.name || "Chủ tài sản"}
          </span>
        </nav>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[360px] rounded-xl" />
              ))}
            </div>
          </div>
        ) : owner ? (
          <>
            {/* Owner Header */}
            <Card className="p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-foreground mb-1">{owner.name}</h1>
                  {owner.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="line-clamp-2">{owner.address}</span>
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
              <Card className="p-4 text-center">
                <Gavel className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Tổng tài sản</p>
              </Card>
              <Card className="p-4 text-center">
                <Trophy className="w-6 h-6 mx-auto mb-2 text-[hsl(142,60%,40%)]" />
                <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.successful}</p>
                <p className="text-xs text-muted-foreground mt-1">Đấu giá thành công</p>
              </Card>
              <Card className="p-4 text-center">
                <Percent className="w-6 h-6 mx-auto mb-2 text-[hsl(25,95%,53%)]" />
                <p className="text-2xl md:text-3xl font-bold text-foreground">{stats.rate}%</p>
                <p className="text-xs text-muted-foreground mt-1">Tỷ lệ thành công</p>
              </Card>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm tài sản..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="registration_open">Mở đăng ký</SelectItem>
                  <SelectItem value="upcoming">Sắp diễn ra</SelectItem>
                  <SelectItem value="ongoing">Đang diễn ra</SelectItem>
                  <SelectItem value="ended">Đã kết thúc</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground mb-4">
              Tìm thấy <span className="font-semibold text-foreground">{filtered.length}</span> tài sản
            </p>

            {/* Listings grid */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((listing) => {
                  const ca = (listing.custom_attributes || {}) as Record<string, any>;
                  return (
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
                      winPrice={ca.win_price ?? ca.winning_price}
                      orgName={ca.org_name}
                      isSaved={savedIds.has(listing.id)}
                      onToggleSave={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(listing.id); }}
                      saveCount={saveCounts.get(listing.id) || 0}
                      viewsCount={listing.views_count || 0}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-lg border border-border">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Không tìm thấy tài sản</h3>
                <p className="text-muted-foreground">Thử điều chỉnh bộ lọc để tìm thấy kết quả</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground mb-2">Không tìm thấy chủ tài sản</h2>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/listings">Quay lại danh sách</Link>
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AssetOwnerDetail;
