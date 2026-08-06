import { lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthState } from "@/hooks/useAuthState";
import { useListingContact } from "@/hooks/useListingContact";
import { useListingById } from "@/hooks/useListingById";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AuctionInfoCard } from "@/components/listings/AuctionInfoCard";
import { OrganizationContactCard } from "@/components/listings/OrganizationContactCard";
import { AuctionDetailTable } from "@/components/listings/AuctionDetailTable";
import { AssetOwnerCard } from "@/components/listings/AssetOwnerCard";
import {
  Maximize, MapPin, Building2, Scale, Compass, Home, FileText, ArrowLeft, ImageOff,
} from "lucide-react";

import { formatPrice, formatDate, formatAddress } from "@/utils/formatters";
import { caString } from "@/types/listing";
import type { LucideIcon } from "lucide-react";

// ─── Tách khỏi entry chunk ────────────────────────────────────────────────────
// LocationMap kéo theo leaflet (~107 refs). Bản đồ nằm dưới màn hình đầu và chỉ
// render khi tin đăng có toạ độ, nên không cần nằm trong bundle mà mọi khách
// vãng lai phải tải.
const LocationMap = lazy(() =>
  import("@/components/listings/LocationMap").then((m) => ({ default: m.LocationMap })),
);

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuthState();
  const isLoggedIn = !!session;

  const { data: listing, isLoading: loading, error } = useListingById(id);
  const { data: contactData, isLoading: contactLoading } = useListingContact(id || "");
  const contactInfo = contactData?.contact_info as { name: string; phone: string; email: string } | null;

  if (!id || error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">{(error as Error)?.message || "Không tìm thấy tin đăng"}</h1>
          <Button onClick={() => navigate("/listings")} className="mt-4">Quay lại danh sách</Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Không tìm thấy tin đăng</h1>
          <Button onClick={() => navigate("/listings")} className="mt-4">Quay lại danh sách</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const address = listing.address || {};
  const addressText = formatAddress(address);
  const propertyTypeName = listing.property_types?.name || "BĐS";
  const purposeLabel = listing.purpose === "FOR_SALE" ? "Bán" : "Cho thuê";
  const coordinates = listing.coordinates || {};
  const customAttributes = listing.custom_attributes || {};
  const hasImage = !!listing.image_url;

  // Property info items
  const propertyDetails = [
    { icon: Maximize, label: "Diện tích", value: `${listing.area} m²` },
    { icon: Home, label: "Loại hình", value: propertyTypeName },
    listing.legal_status && { icon: FileText, label: "Pháp lý", value: listing.legal_status },
    listing.house_direction && { icon: Compass, label: "Hướng nhà", value: listing.house_direction },
    listing.land_direction && { icon: Compass, label: "Hướng đất", value: listing.land_direction },
    listing.facade_width && { icon: Maximize, label: "Mặt tiền", value: `${listing.facade_width} m` },
    listing.depth && { icon: Maximize, label: "Chiều sâu", value: `${listing.depth} m` },
    listing.num_floors && { icon: Building2, label: "Số tầng", value: listing.num_floors },
    listing.land_type && { icon: Scale, label: "Loại đất", value: listing.land_type },
  ].filter(Boolean) as { icon: LucideIcon; label: string; value: string | number }[];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6 md:py-8">
        <Button variant="ghost" onClick={() => navigate("/listings")} className="mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Quay lại danh sách
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* === Left Column === */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image / Placeholder */}
            {hasImage ? (
              <div className="rounded-xl overflow-hidden aspect-video bg-muted">
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="rounded-xl bg-muted/50 border border-dashed border-border flex flex-col items-center justify-center py-12">
                <ImageOff className="w-12 h-12 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Chưa có hình ảnh tài sản</p>
              </div>
            )}

            {/* Title + Badges */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">{purposeLabel}</Badge>
                <Badge variant="secondary">{propertyTypeName}</Badge>
                {listing.legal_status && (
                  <Badge variant="outline">{listing.legal_status}</Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                {listing.title}
              </h1>
              {addressText && (
                <p className="text-muted-foreground flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  {addressText}
                </p>
              )}
            </div>

            {/* Auction Detail Table */}
            <AuctionDetailTable attributes={customAttributes} />

            {/* Asset Owner */}
            <AssetOwnerCard
              name={caString(customAttributes.asset_owner_name)}
              address={caString(customAttributes.asset_owner_address)}
              ownerId={listing.asset_owner_id}
            />

            {/* Property Details Grid */}
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-foreground mb-4">Thông tin tài sản</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {propertyDetails.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-medium text-foreground text-sm">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Prominent Features */}
            {listing.prominent_features?.length > 0 && (
              <Card className="p-5">
                <h2 className="text-lg font-semibold text-foreground mb-3">Đặc điểm nổi bật</h2>
                <div className="flex flex-wrap gap-2">
                  {listing.prominent_features.map((f: string, i: number) => (
                    <Badge key={i} variant="secondary">{f}</Badge>
                  ))}
                </div>
              </Card>
            )}

            {/* Description */}
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-foreground mb-3">Mô tả chi tiết</h2>
              <p className="text-foreground leading-relaxed whitespace-pre-line text-sm">
                {listing.description || "Chưa có mô tả"}
              </p>
            </Card>

            {/* Location / Map */}
            {(addressText || (coordinates.lat && coordinates.lng)) && (
              <Card className="p-5">
                <h2 className="text-lg font-semibold text-foreground mb-3">Vị trí</h2>
                <div className="space-y-3">
                  {listing.building_name && (
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-primary mt-0.5" />
                      <p className="text-foreground text-sm">{listing.building_name}</p>
                    </div>
                  )}
                  {coordinates.lat && coordinates.lng && (
                    <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
                      <LocationMap latitude={coordinates.lat} longitude={coordinates.lng} />
                    </Suspense>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* === Right Column (Sticky Sidebar) === */}
          <div className="lg:col-span-1 space-y-6">
            <div className="lg:sticky lg:top-4 space-y-6">
              {/* Auction Info */}
              <AuctionInfoCard
                price={listing.price}
                priceUnit={listing.price_unit}
                customAttributes={customAttributes}
                isLoggedIn={isLoggedIn}
              />

              {/* Organization Contact */}
              <OrganizationContactCard
                contactInfo={contactInfo}
                loading={contactLoading}
                customAttributes={customAttributes}
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export { ListingDetail as default };
