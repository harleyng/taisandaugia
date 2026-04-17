import { useParams, Link, useLocation } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuctionCard } from "@/components/AuctionCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ChevronRight, Search, Gavel, Trophy, Percent, Phone, Mail, MapPin, Lock, Sparkles } from "lucide-react";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { useAssetActions } from "@/hooks/useAssetActions";
import { useListingSaveCounts } from "@/hooks/useListingSaveCounts";
import { NotificationPromptDialog } from "@/components/NotificationPromptDialog";
import { formatAddress } from "@/utils/formatters";
import { useCredits } from "@/hooks/useCredits";
import { usePaywall } from "@/contexts/PaywallContext";
import { LockedBlur } from "@/components/paywall/LockedBlur";

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const fromListing = (location.state as { fromListing?: { id: string; title: string } } | null)?.fromListing;
  const { savedIds, toggleSave, showNotificationPrompt, dismissNotificationPrompt } = useAssetActions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { companyAccess } = useCredits();
  const { openCompanyPaywall } = usePaywall();
  const access = id ? companyAccess(id) : { isUnlocked: false, tier: null, expiresAt: null };
  const isCompanyUnlocked = access.isUnlocked;

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["auction-org", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_organizations")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["auction-org-listings", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("auction_org_id", id!)
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

  const isLoading = orgLoading || listingsLoading;

  if (!id) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <NotificationPromptDialog open={showNotificationPrompt} onClose={dismissNotificationPrompt} />

      <main className="container px-4 py-6 flex-1">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link to="/" className="hover:text-foreground transition-colors">Trang chủ</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/listings" className="hover:text-foreground transition-colors">Danh sách</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          {fromListing && (
            <>
              <Link
                to={`/auctions/${fromListing.id}`}
                className="hover:text-foreground transition-colors truncate max-w-[280px]"
                title={fromListing.title}
              >
                {fromListing.title}
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
            </>
          )}
          <span className="text-foreground font-medium truncate max-w-[250px]">
            {org?.name || "Tổ chức đấu giá"}
          </span>
        </nav>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-xl" />
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
        ) : org ? (
          <>
            {/* Company Header */}
            <Card className="p-6 mb-6">
              <div className="flex items-start gap-4">
                <img
                  src={org.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(org.name)}&background=1e40af&color=fff&size=96&bold=true`}
                  alt={org.name}
                  className="w-16 h-16 rounded-xl flex-shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-foreground mb-1.5">{org.name}</h1>
                  {(() => {
                    const orgTypeLabels: Record<number, string> = {
                      0: "Trung tâm đấu giá",
                      1: "Doanh nghiệp đấu giá",
                      2: "Công ty đấu giá",
                      11: "Chi nhánh công ty đấu giá",
                    };
                    const label = (org as any).org_type != null ? orgTypeLabels[(org as any).org_type as number] : null;
                    return label ? (
                      <Badge variant="secondary" className="mb-2 font-medium">{label}</Badge>
                    ) : null;
                  })()}
                  {org.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="line-clamp-1">{org.address}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {(org.phone || org.email) && (
                      isCompanyUnlocked ? (
                        <>
                          {org.phone && (
                            <a href={`tel:${org.phone}`} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                              <Phone className="w-3.5 h-3.5" /> {org.phone}
                            </a>
                          )}
                          {org.email && (
                            <a href={`mailto:${org.email}`} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                              <Mail className="w-3.5 h-3.5" /> {org.email}
                            </a>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCompanyPaywall(id!)}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Liên hệ – mở khóa hồ sơ
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {isCompanyUnlocked ? (
              <>
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

                {/* Tier 2/3 analytics placeholder */}
                {(access.tier === "30d" || access.tier === "1y") && (
                  <Card className="p-4 mb-6 border-dashed">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Phân tích nhóm theo khu vực & giá</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Sắp ra mắt — bạn sẽ tự động được truy cập khi tính năng có sẵn.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

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

                <p className="text-sm text-muted-foreground mb-4">
                  Tìm thấy <span className="font-semibold text-foreground">{filtered.length}</span> tài sản
                </p>

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
                          orgName={org.name}
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
              /* LOCKED STATE — full company gate */
              <Card className="p-6 md:p-10 text-center border-2 border-dashed border-primary/30 bg-primary/[0.02]">
                <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                  🔒 Hồ sơ đơn vị đấu giá
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Xem toàn bộ danh sách tài sản và hiểu nhanh nguồn đấu giá trước khi quyết định.
                </p>

                {/* Teaser blurred grid */}
                <div className="relative max-w-3xl mx-auto mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 select-none pointer-events-none blur-md opacity-60">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="aspect-[4/5] rounded-lg bg-muted" />
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto mb-6 text-left">
                  {[
                    { label: "7 ngày", desc: "Xem toàn bộ danh sách tài sản" },
                    { label: "30 ngày", desc: "Hiểu nhanh nguồn — nhóm theo khu vực & giá" },
                    { label: "1 năm", desc: "Theo dõi nguồn đấu giá dài hạn" },
                  ].map((t) => (
                    <div key={t.label} className="rounded-lg border border-border bg-card p-3">
                      <p className="text-sm font-bold text-foreground mb-1">{t.label}</p>
                      <p className="text-xs text-muted-foreground leading-snug">{t.desc}</p>
                    </div>
                  ))}
                </div>

                <Button size="lg" onClick={() => openCompanyPaywall(id!)}>
                  Xem các gói mở khóa
                </Button>

                <p className="text-xs text-muted-foreground mt-4 max-w-md mx-auto">
                  Dữ liệu sẽ được cập nhật và phân tích sâu hơn trong thời gian tới.
                </p>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground mb-2">Không tìm thấy tổ chức</h2>
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

export default CompanyDetail;
