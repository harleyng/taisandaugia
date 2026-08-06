import { lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthState } from "@/hooks/useAuthState";
import { useListingById } from "@/hooks/useListingById";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  BellRing,
  ChevronRight,
  ExternalLink,
  Eye,
  Search,
  Lock,
  Share2,
  Facebook,
  Link as LinkIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAssetActions } from "@/hooks/useAssetActions";
import { AuctionQuickInfo } from "@/components/auction/AuctionQuickInfo";
import { AuctionOrganizerInfo } from "@/components/auction/AuctionOrganizerInfo";
import { AuctionScheduleInfo } from "@/components/auction/AuctionScheduleInfo";
import { AuctionAttachments } from "@/components/auction/AuctionAttachments";
import { AuctionAssetOwnerCard } from "@/components/auction/AuctionAssetOwnerCard";
import { AuctionSimilarAssets } from "@/components/auction/AuctionSimilarAssets";
import { Link } from "react-router-dom";
import { formatAddress } from "@/utils/formatters";
import { useListingSaveCounts } from "@/hooks/useListingSaveCounts";
import { useAuthGuardedNavigate } from "@/hooks/useAuthGuardedNavigate";
import { useCredits } from "@/hooks/useCredits";
import { usePaywall } from "@/contexts/PaywallContext";
import { LockedBlur } from "@/components/paywall/LockedBlur";
import { useCompanyViewTracker } from "@/hooks/useCompanyViewTracker";
import { Sparkles, X } from "lucide-react";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { AuctionAssetCard, type AuctionAsset } from "@/components/auction/AuctionAssetCard";
import { caNumber, caString, caStringArray } from "@/types/listing";

// ─── Tách khỏi entry chunk ────────────────────────────────────────────────────
// Hai khối này kéo theo recharts (~400 kB raw). Cả hai đều nằm dưới màn hình
// đầu nên lazy không ảnh hưởng LCP, nhưng cứu được entry bundle mà MỌI khách
// vãng lai phải tải.
const AuctionPriceHistory = lazy(() =>
  import("@/components/auction/AuctionPriceHistory").then((m) => ({ default: m.AuctionPriceHistory })),
);
const AuctionPricePrediction = lazy(() =>
  import("@/components/auction/AuctionPricePrediction").then((m) => ({ default: m.AuctionPricePrediction })),
);

const AuctionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { savedIds, toggleSave } = useAssetActions();
  const { session } = useAuthState();
  const { data: listing, isLoading: loading, error } = useListingById(id);
  const saveCounts = useListingSaveCounts(listing ? [listing.id] : []);
  const guardedNavigate = useAuthGuardedNavigate();
  const { assetUnlocked, unlockAsset, lockAsset, addCredits, balance, ASSET_COST } = useCredits();
  const { openAssetPaywall, openCompanyPaywall } = usePaywall();
  const { openAuthDialog } = useAuthDialog();
  const { shouldNudge, dismiss } = useCompanyViewTracker(listing?.auction_org_id, listing?.id);
  const isLoggedIn = !!session;
  const isUnlocked = listing ? isLoggedIn && assetUnlocked(listing.id) : false;
  const ownerClick = listing?.asset_owner_id ? guardedNavigate(`/asset-owner/${listing.asset_owner_id}`) : undefined;

  if (!id || error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">{(error as Error)?.message || "Không tìm thấy"}</h1>
          <Button onClick={() => navigate("/listings")} className="mt-4">
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-64 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
            <div>
              <Skeleton className="h-80 w-full rounded-lg" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!listing) return null;

  const addressText = formatAddress(listing.address || {});
  const ca = listing.custom_attributes || {};
  const sourceUrls = caStringArray(ca.source_urls);

  const winPrice = caNumber(ca.winning_price ?? ca.win_price);
  const auctionDateStr = caString(ca.auction_date);
  const auctionDate = auctionDateStr ? new Date(auctionDateStr) : null;
  const isUpcoming = !winPrice && (!auctionDate || auctionDate >= new Date());

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-4 md:py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
          <Link to="/" className="hover:text-foreground transition-colors">
            Trang chủ
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/listings" className="hover:text-foreground transition-colors">
            Danh sách
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate max-w-[300px]">{listing.title}</span>
        </nav>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats + actions row (inside left column so right sticky can rise above) */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span className="font-medium">{listing.views_count || 0}</span>
                <span>lượt xem</span>
              </span>
              {/* "X quan tâm" chip removed per design update */}

              <div className="ml-auto flex items-center gap-2">
                {(() => {
                  const isFollowing = savedIds.has(listing.id);
                  const Icon = isFollowing ? BellRing : Bell;
                  return (
                    <Button
                      variant={isFollowing ? "default" : "outline"}
                      size="sm"
                      className="rounded-full"
                      onClick={() => toggleSave(listing.id)}
                      aria-label={isFollowing ? "Đang nhận thông báo — bấm để dừng" : "Nhận thông báo khi có cập nhật"}
                    >
                      <Icon className="h-4 w-4 mr-1.5" />
                      {isFollowing ? "Đang nhận thông báo" : "Nhận thông báo khi có cập nhật"}
                    </Button>
                  );
                })()}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full" aria-label="Chia sẻ">
                      <Share2 className="h-4 w-4 mr-1.5" />
                      Chia sẻ
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        const url = encodeURIComponent(window.location.href);
                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <Facebook className="h-4 w-4 mr-2" />
                      Facebook
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(window.location.href);
                          toast.success("Đã sao chép liên kết");
                        } catch {
                          toast.error("Không thể sao chép");
                        }
                      }}
                    >
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Sao chép liên kết
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* 1. Tài sản đấu giá (one or many) */}
            {(() => {
              const rawAssets: AuctionAsset[] = Array.isArray(ca.assets) && ca.assets.length > 0
                ? ca.assets
                : [{
                    title: listing.title,
                    description: listing.description || undefined,
                    category: listing.property_types?.name,
                    quantity: ca.quantity,
                    area: listing.area || ca.area || undefined,
                    location: addressText || undefined,
                    legal_status: listing.legal_status || undefined,
                    notes: ca.notes || undefined,
                    starting_price: listing.price,
                    deposit_amount: ca.deposit_amount,
                    document_fee: ca.document_fee,
                    bid_step: ca.bid_step ?? ca.step_price,
                    winning_price: ca.winning_price ?? ca.win_price ?? null,
                    auction_format: ca.auction_format,
                    bidding_method: ca.bidding_method,
                  }]

              return (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">
                    Thông tin tài sản đấu giá
                    {rawAssets.length > 1 && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({rawAssets.length} tài sản)
                      </span>
                    )}
                  </h3>
                  {rawAssets.map((asset, i) => (
                    <AuctionAssetCard
                      key={i}
                      asset={asset}
                      index={i}
                      defaultOpen={rawAssets.length === 1 || i === 0}
                      isUnlocked={isUnlocked}
                      isLoggedIn={isLoggedIn}
                      onLockedClick={() => openAssetPaywall(listing.id, listing.title)}
                      onLoginClick={() => openAuthDialog(() => openAssetPaywall(listing.id, listing.title))}
                    />
                  ))}
                </div>
              )
            })()}

            {/* 2b. Chủ tài sản (clickable card) */}
            {listing.asset_owner_id && (
              <AuctionAssetOwnerCard
                ownerId={listing.asset_owner_id}
                fromListing={{ id: listing.id, title: listing.title }}
              />
            )}

            {/* 3. Organizer */}
            <AuctionOrganizerInfo listing={listing} isUnlocked={true} />

            {/* 4. Schedule */}
            <AuctionScheduleInfo listing={listing} />

            {/* 5. Attachments */}
            <AuctionAttachments listing={listing} />

            {/* 6. Price history (Bất động sản only) — paywall preview tự xử lý trong block (AC8) */}
            <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
              <AuctionPriceHistory
                listing={listing}
                isUnlocked={isUnlocked}
                isLoggedIn={isLoggedIn}
                onLogin={() => openAuthDialog(() => openAssetPaywall(listing.id, listing.title))}
                onUnlock={() => openAssetPaywall(listing.id, listing.title)}
              />
            </Suspense>

            {/* 7. Dự đoán giá trúng (chỉ hiển thị với phiên chưa kết thúc) — paywall preview tự xử lý trong block, giống Lịch sử giá */}
            {isUpcoming && (
              <Suspense fallback={<Skeleton className="h-56 w-full rounded-2xl" />}>
                <AuctionPricePrediction
                  listing={listing}
                  isUnlocked={isUnlocked}
                  onUnlock={() =>
                    isLoggedIn
                      ? openAssetPaywall(listing.id, listing.title)
                      : openAuthDialog(() => openAssetPaywall(listing.id, listing.title))
                  }
                />
              </Suspense>
            )}

            {/* 7. Sources */}
            {sourceUrls.length > 0 && (
              <Card className="p-5 space-y-3">
                <h3 className="text-lg font-bold text-foreground">Nguồn</h3>
                <ul className="space-y-2">
                  {sourceUrls.map((url, i) => (
                    <li key={i}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN — Sticky Sidebar */}
          <div className="lg:col-span-1 order-first lg:order-none">
            <div className="lg:sticky lg:top-4">
              <AuctionQuickInfo
                price={listing.price}
                area={listing.area}
                customAttributes={ca}
                listing={listing}
                saveCount={saveCounts.get(listing.id) || 0}
                title={listing.title}
                propertyTypeName={listing.property_types?.name}
                legalStatus={listing.legal_status}
              />

              {/* DEBUG: Toggle paywall (dev only) */}
              <button
                type="button"
                onClick={() => {
                  if (isUnlocked) {
                    lockAsset(listing.id);
                  } else {
                    if (balance < ASSET_COST) addCredits(ASSET_COST);
                    unlockAsset(listing.id, listing.title);
                  }
                }}
                className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md py-2 transition-colors"
                title="Debug: bật/tắt paywall tài sản"
              >
                🛠 Debug: {isUnlocked ? "Khoá lại paywall" : "Mở khoá paywall"}
              </button>
            </div>
          </div>
        </div>

        {/* Similar Assets */}
        <div className="mt-10">
          <AuctionSimilarAssets listing={listing} />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AuctionDetail;
