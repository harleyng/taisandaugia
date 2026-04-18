import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
import { NotificationPromptDialog } from "@/components/NotificationPromptDialog";
import { AuctionQuickInfo } from "@/components/auction/AuctionQuickInfo";
import { AuctionPriceRow } from "@/components/auction/AuctionPriceRow";
import { AuctionOrganizerInfo } from "@/components/auction/AuctionOrganizerInfo";
import { AuctionScheduleInfo } from "@/components/auction/AuctionScheduleInfo";
import { AuctionAttachments } from "@/components/auction/AuctionAttachments";
import { AuctionAssetOwnerCard } from "@/components/auction/AuctionAssetOwnerCard";
import { AuctionPriceHistory } from "@/components/auction/AuctionPriceHistory";
import { AuctionSimilarAssets } from "@/components/auction/AuctionSimilarAssets";
import { Link } from "react-router-dom";
import { formatAddress } from "@/utils/formatters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useListingSaveCounts } from "@/hooks/useListingSaveCounts";
import { useAuthGuardedNavigate } from "@/hooks/useAuthGuardedNavigate";
import { useCredits } from "@/hooks/useCredits";
import { usePaywall } from "@/contexts/PaywallContext";
import { LockedBlur } from "@/components/paywall/LockedBlur";
import { useCompanyViewTracker } from "@/hooks/useCompanyViewTracker";
import { AuctionPricePrediction } from "@/components/auction/AuctionPricePrediction";
import { Sparkles, X } from "lucide-react";
import { useAuthDialog } from "@/contexts/AuthDialogContext";

const AuctionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { savedIds, toggleSave, showNotificationPrompt, dismissNotificationPrompt } = useAssetActions();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(true);
  const [session, setSession] = useState<any>(null);
  const saveCounts = useListingSaveCounts(listing ? [listing.id] : []);
  const guardedNavigate = useAuthGuardedNavigate();
  const { assetUnlocked, unlockAsset, lockAsset, addCredits, balance, ASSET_COST } = useCredits();
  const { openAssetPaywall, openCompanyPaywall } = usePaywall();
  const { openAuthDialog } = useAuthDialog();
  const { shouldNudge, dismiss } = useCompanyViewTracker(listing?.auction_org_id, listing?.id);
  const isLoggedIn = !!session;
  const isUnlocked = listing ? isLoggedIn && assetUnlocked(listing.id) : false;
  const ownerClick = listing?.asset_owner_id ? guardedNavigate(`/asset-owner/${listing.asset_owner_id}`) : undefined;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) {
        setError("ID không hợp lệ");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data, error: err } = await supabase.from("listings").select("*").eq("id", id).single();
        if (err) throw err;
        if (!data) {
          setError("Không tìm thấy tài sản");
          setLoading(false);
          return;
        }

        const { data: pt } = await supabase
          .from("property_types")
          .select("name, slug")
          .eq("slug", data.property_type_slug)
          .single();

        setListing({ ...data, property_types: pt || { name: "BĐS", slug: data.property_type_slug } });
        setError(null);
      } catch (e: any) {
        setError(e.message || "Đã có lỗi xảy ra");
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id]);

  if (!id || error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">{error || "Không tìm thấy"}</h1>
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
  const sourceUrls: string[] = ca.source_urls || [];

  const winPrice = ca.winning_price ?? ca.win_price;
  const auctionDateStr = ca.auction_date;
  const auctionDate = auctionDateStr ? new Date(auctionDateStr) : null;
  const isUpcoming = !winPrice && (!auctionDate || auctionDate >= new Date());

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <NotificationPromptDialog open={showNotificationPrompt} onClose={dismissNotificationPrompt} />

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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                <Heart className="h-4 w-4 fill-current text-rose-400" />
                <span className="font-medium">{saveCounts.get(listing.id) || 0}</span>
                <span>quan tâm</span>
              </span>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => toggleSave(listing.id)}
                  aria-label={savedIds.has(listing.id) ? "Bỏ quan tâm" : "Quan tâm"}
                >
                  <Heart className={`h-4 w-4 mr-1.5 ${savedIds.has(listing.id) ? "fill-rose-500 text-rose-500" : ""}`} />
                  {savedIds.has(listing.id) ? "Đã quan tâm" : "Quan tâm"}
                </Button>

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

            {/* 1. Thông tin việc đấu giá — Collapsible */}
            <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
              <Card className="p-5 space-y-4">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full text-left">
                    <h3 className="text-lg font-bold text-foreground">Thông tin tài sản đấu giá</h3>
                    {infoOpen ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4">
                  {/* Description */}
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {listing.description || "Chưa có mô tả"}
                  </p>

                  {/* Metadata */}
                  <div className="space-y-2 text-sm">
                    {ca.quantity && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground min-w-[120px]">Số lượng:</span>
                        <span className="text-foreground font-medium">{ca.quantity}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-muted-foreground min-w-[120px]">Loại BĐS:</span>
                      <span className="text-foreground font-medium">{listing.property_types?.name || "BĐS"}</span>
                    </div>
                    {addressText && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground min-w-[120px]">Nơi có tài sản:</span>
                        <span className="text-foreground font-medium">{addressText}</span>
                      </div>
                    )}
                    {ca.notes && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground min-w-[120px]">Ghi chú:</span>
                        <span className="text-foreground font-medium">{ca.notes}</span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* 2. Price Row */}
            <AuctionPriceRow
              price={listing.price}
              customAttributes={ca}
              isUnlocked={isUnlocked}
              onLockedClick={() => openAssetPaywall(listing.id, listing.title)}
            />

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

            {/* 6. Price history (Bất động sản only) — paywalled */}
            {isUnlocked ? (
              <AuctionPriceHistory listing={listing} />
            ) : (
              <LockedBlur
                ctaLabel={isLoggedIn ? "Mở khóa lịch sử đấu giá" : "Đăng nhập để mở khóa"}
                teaser="Xem lịch sử giá đấu giá khu vực"
                futureNote="Truy cập biểu đồ biến động giá theo thời gian, mức đỉnh và xu hướng để đánh giá cơ hội."
                onUnlockClick={() =>
                  isLoggedIn
                    ? openAssetPaywall(listing.id, listing.title)
                    : openAuthDialog(() => openAssetPaywall(listing.id, listing.title))
                }
                minHeight="520px"
              >
                <AuctionPriceHistory listing={listing} />
              </LockedBlur>
            )}

            {/* 7. Dự đoán giá trúng (chỉ hiển thị với phiên chưa kết thúc) — paywalled */}
            {isUpcoming && (
              isUnlocked ? (
                <AuctionPricePrediction listing={listing} isUnlocked={true} onUnlock={() => {}} />
              ) : (
                <LockedBlur
                  ctaLabel={isLoggedIn ? "Mở khóa dự đoán giá trúng" : "Đăng nhập để mở khóa"}
                  teaser="Xem dự đoán giá trúng phiên đấu giá"
                  futureNote="Phân tích dựa trên dữ liệu phiên tương tự, mức cạnh tranh và độ tin cậy mô hình."
                  onUnlockClick={() =>
                    isLoggedIn
                      ? openAssetPaywall(listing.id, listing.title)
                      : openAuthDialog(() => openAssetPaywall(listing.id, listing.title))
                  }
                  minHeight="420px"
                >
                  <AuctionPricePrediction listing={listing} isUnlocked={true} onUnlock={() => {}} />
                </LockedBlur>
              )
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
