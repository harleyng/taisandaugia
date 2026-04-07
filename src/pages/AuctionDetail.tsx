import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, Bell, MapPin, ChevronRight } from "lucide-react";
import { useAssetActions } from "@/hooks/useAssetActions";
import { AuctionQuickInfo } from "@/components/auction/AuctionQuickInfo";
import { AuctionInfoTable } from "@/components/auction/AuctionInfoTable";
import { AuctionOrganizerInfo } from "@/components/auction/AuctionOrganizerInfo";
import { AuctionScheduleInfo } from "@/components/auction/AuctionScheduleInfo";
import { AuctionAttachments } from "@/components/auction/AuctionAttachments";
import { AuctionSimilarAssets } from "@/components/auction/AuctionSimilarAssets";
import { Link } from "react-router-dom";
import { formatAddress } from "@/utils/formatters";

const AuctionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { savedIds, followingIds, toggleSave, toggleFollow } = useAssetActions();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) { setError("ID không hợp lệ"); setLoading(false); return; }
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from("listings").select("*").eq("id", id).single();
        if (err) throw err;
        if (!data) { setError("Không tìm thấy tài sản"); setLoading(false); return; }

        const { data: pt } = await supabase
          .from("property_types").select("name, slug")
          .eq("slug", data.property_type_slug).single();

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
          <Button onClick={() => navigate("/listings")} className="mt-4">Quay lại</Button>
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-4 md:py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
          <Link to="/" className="hover:text-foreground transition-colors">Trang chủ</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/listings" className="hover:text-foreground transition-colors">Danh sách</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium truncate max-w-[300px]">{listing.title}</span>
        </nav>

        {/* Title + Address */}
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground leading-tight">
            {listing.title}
          </h1>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* LEFT COLUMN — Info Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Mô tả tài sản */}
            <Card className="p-5 space-y-4">
              <h3 className="text-lg font-bold text-foreground">Mô tả tài sản</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {listing.description || "Chưa có mô tả"}
              </p>
              {(ca.asset_owner_name || ca.asset_owner_address) && (
                <>
                  <div className="h-px bg-border" />
                  <p className="text-sm text-muted-foreground">
                    <span className="text-muted-foreground">Chủ tài sản:</span>{" "}
                    <span className="text-foreground font-medium">
                      {[ca.asset_owner_name, ca.asset_owner_address].filter(Boolean).join(" - ")}
                    </span>
                  </p>
                </>
              )}
            </Card>

            {/* Section 2: Đơn vị tổ chức & Địa điểm */}
            <AuctionOrganizerInfo listing={listing} />

            {/* Section 3: Lịch trình đấu giá */}
            <AuctionScheduleInfo listing={listing} />

            {/* Section 4: File đính kèm */}
            <AuctionAttachments listing={listing} />

          </div>

          {/* RIGHT COLUMN — Sticky Sidebar */}
          <div className="lg:col-span-1 order-first lg:order-none">
            <div className="lg:sticky lg:top-4">
              <AuctionQuickInfo
                price={listing.price}
                area={listing.area}
                customAttributes={ca}
                listing={listing}
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
