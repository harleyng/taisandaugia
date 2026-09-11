import { useParams, Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ChevronRight, Phone, Mail, MapPin, X } from "lucide-react";
import { AuctioneerTeamSection } from "@/components/company/AuctioneerTeamSection";
import { CompanyListingsTab } from "@/components/company/CompanyListingsTab";
import { CompanySessionsTab } from "@/components/company/CompanySessionsTab";
import { useAuctionOrgListings } from "@/hooks/useAuctionOrgListings";
import { usePublicOrgSessions } from "@/hooks/usePublicAuctionSessions";
import type { AgentInfoShape } from "@/lib/onboardingTasks";
import { qk } from "@/lib/queryKeys";

// Tab điều khiển bằng ?tab= (khuôn ProfilePage) để link chia sẻ mở đúng tab.
const TAB_SLUGS = ["tai-san", "phien-dau-gia"] as const;
type CompanyTab = (typeof TAB_SLUGS)[number];
const DEFAULT_TAB: CompanyTab = "tai-san";

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromListing = (location.state as { fromListing?: { id: string; title: string } } | null)?.fromListing;
  const [showClaimBanner, setShowClaimBanner] = useState(false);

  const tabParam = searchParams.get("tab");
  const activeTab: CompanyTab = TAB_SLUGS.includes(tabParam as CompanyTab) ? (tabParam as CompanyTab) : DEFAULT_TAB;
  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === DEFAULT_TAB) next.delete("tab");
    else next.set("tab", value);
    // Giữ location.state: breadcrumb "từ tin đấu giá" đọc từ đó.
    setSearchParams(next, { replace: true, state: location.state });
  };

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: qk.auctionOrg(id),
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

  // Chỉ để đếm số trên nhãn tab — dùng chung cache với nội dung từng tab.
  const { data: listings } = useAuctionOrgListings(id);
  const { data: sessions } = usePublicOrgSessions(id);

  useEffect(() => {
    if (localStorage.getItem("org.claim.banner.dismissed")) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.id) { setShowClaimBanner(true); return; }
      // Check if any organization has already claimed this auction org
      const { data: linked } = await supabase
        .from("organizations")
        .select("id")
        .eq("name", org?.name ?? "")
        .maybeSingle();
      if (linked) return; // already claimed — hide banner
      const { data: profile } = await supabase
        .from("profiles")
        .select("agent_info")
        .eq("id", session.user.id)
        .single();
      const role = (profile?.agent_info as AgentInfoShape | null)?.basic?.role;
      if (role !== "company") setShowClaimBanner(true);
    });
  }, [id, org?.name]);

  const dismissClaimBanner = () => {
    localStorage.setItem("org.claim.banner.dismissed", "true");
    setShowClaimBanner(false);
  };

  if (!id) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

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

        {orgLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-10 w-72 rounded-lg" />
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
                    const label = org.org_type != null ? orgTypeLabels[org.org_type] : null;
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
                  </div>
                </div>
              </div>
            </Card>

            {showClaimBanner && (
              <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Bạn là công ty đấu giá?</p>
                  <p className="text-xs text-muted-foreground">Xác thực để thiết lập hồ sơ năng lực trên nền tảng.</p>
                </div>
                <Link to="/dang-ky-to-chuc">
                  <Button size="sm" className="whitespace-nowrap shrink-0">Bắt đầu xác thực</Button>
                </Link>
                <button
                  onClick={dismissClaimBanner}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-1 flex-shrink-0"
                  aria-label="Ẩn thông báo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Đội ngũ ĐGV — tổ chức tự bật chia sẻ từng người. */}
            <AuctioneerTeamSection auctionOrgId={id} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="tai-san">
                  Tài sản{listings ? ` (${listings.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="phien-dau-gia">
                  Phiên đấu giá{sessions ? ` (${sessions.length})` : ""}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tai-san">
                <CompanyListingsTab auctionOrgId={id} orgName={org.name} />
              </TabsContent>
              <TabsContent value="phien-dau-gia">
                <CompanySessionsTab auctionOrgId={id} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground mb-2">Không tìm thấy tổ chức</h2>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/listings")}>
              Quay lại danh sách
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default CompanyDetail;
