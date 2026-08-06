import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuctionSection } from "@/components/AuctionSection";
import { MarketReportTeaser } from "@/components/MarketReportTeaser";
import { CompletedAuctions } from "@/components/CompletedAuctions";
import { FeaturedProjects } from "@/components/FeaturedProjects";
import { PopularAreas } from "@/components/PopularAreas";
import { NewsSection } from "@/components/NewsSection";
import { HomepageRewardBanner } from "@/components/HomepageRewardBanner";
import { CollaborationDialog } from "@/components/CollaborationDialog";
import { PartnersSection } from "@/components/PartnersSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Handshake, Building2, Home, LandPlot, MapPin, Building, Landmark, Search, Package, Users, ChevronsUpDown, Check, ArrowRight, BarChart3, Shield, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, type ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/hero-image.jpg";
import { qk } from "@/lib/queryKeys";

const heroLocations = [
  { value: "all", label: "Toàn quốc" },
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "TP. HCM", label: "TP. HCM" },
  { value: "Đà Nẵng", label: "Đà Nẵng" },
  { value: "Bình Dương", label: "Bình Dương" },
  { value: "Đồng Nai", label: "Đồng Nai" },
];

const heroPropertyTypes = [
  { value: "all", label: "Tất cả" },
  { value: "quyen-su-dung-dat", label: "Quyền sử dụng đất" },
  { value: "nha-rieng-le", label: "Nhà riêng lẻ" },
  { value: "can-ho", label: "Căn hộ" },
  { value: "dat-du-an", label: "Đất dự án" },
  { value: "thi-hanh-an", label: "Thi hành án" },
  { value: "tai-san-cong", label: "Tài sản công" },
];

const auctionCategories = [
{ label: "Quyền sử dụng đất", slug: "quyen-su-dung-dat", icon: LandPlot },
{ label: "Nhà riêng lẻ", slug: "nha-rieng-le", icon: Home },
{ label: "Căn hộ", slug: "can-ho", icon: Building2 },
{ label: "Đất dự án", slug: "dat-du-an", icon: MapPin },
{ label: "Thi hành án", slug: "thi-hanh-an", icon: Landmark },
{ label: "Tài sản công", slug: "tai-san-cong", icon: Building }];


type HeroTab = "tai-san" | "cong-ty" | "chu-tai-san";

const heroTabs: { key: HeroTab; label: string; icon: ElementType }[] = [
  { key: "tai-san", label: "Tài sản", icon: Package },
  { key: "cong-ty", label: "Công ty đấu giá", icon: Building2 },
  { key: "chu-tai-san", label: "Chủ tài sản", icon: Users },
];

const analyticsStats = [
  {
    icon: Home,
    value: "12.450+",
    label: "Tài sản đang đấu giá",
  },
  {
    icon: Building2,
    value: "58.300+",
    label: "Tỷ đồng giá trị tài sản",
  },
  {
    icon: Landmark,
    value: "230+",
    label: "Công ty đấu giá tham gia",
  },
  {
    icon: LandPlot,
    value: "1.280+",
    label: "Phiên đấu giá đang diễn ra",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [collabOpen, setCollabOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HeroTab>("tai-san");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetLocation, setAssetLocation] = useState("all");
  const [assetType, setAssetType] = useState("all");
  const [companyId, setCompanyId] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyLocation, setCompanyLocation] = useState("all");
  const [companyType, setCompanyType] = useState("all");
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerLocation, setOwnerLocation] = useState("all");
  const [ownerType, setOwnerType] = useState("all");

  const { data: companies = [] } = useQuery({
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

  const handleSearch = () => {
    if (activeTab === "tai-san") {
      const params = new URLSearchParams();
      params.set("purpose", "auction");
      if (assetQuery) params.set("q", assetQuery);
      if (assetLocation && assetLocation !== "all") params.set("location", assetLocation);
      if (assetType && assetType !== "all") params.set("propertyType", assetType);
      navigate(`/listings?${params.toString()}`);
    } else if (activeTab === "cong-ty") {
      const params = new URLSearchParams();
      if (companyId) params.set("organization", companyId);
      if (companyLocation && companyLocation !== "all") params.set("location", companyLocation);
      if (companyType && companyType !== "all") params.set("propertyType", companyType);
      navigate(`/listings?${params.toString()}`);
    } else {
      const params = new URLSearchParams();
      if (ownerQuery) params.set("owner", ownerQuery);
      if (ownerLocation && ownerLocation !== "all") params.set("location", ownerLocation);
      if (ownerType && ownerType !== "all") params.set("propertyType", ownerType);
      navigate(`/listings?${params.toString()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Bất động sản"
          className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative container px-4 pt-28 pb-10 md:pt-36 md:pb-14">
          {/* Title */}
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-[40px] md:text-[56px] font-bold text-white mb-3 leading-tight">
              Săn tài sản đấu giá toàn quốc
            </h1>
            <p className="text-lg md:text-2xl text-white/80 max-w-2xl mx-auto leading-relaxed">
              Săn đúng tài sản - Ra quyết định hiệu quả - Tối ưu lợi nhuận đấu giá
            </p>
          </div>

          {/* Search card */}
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {heroTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors relative ${
                      active
                        ? "text-[#1a3a6b] bg-white"
                        : "text-gray-500 bg-gray-50 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    {tab.label}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a3a6b]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search inputs */}
            <div className="p-4 md:p-5">
              {activeTab === "tai-san" && (
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={assetQuery}
                      onChange={(e) => setAssetQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Tìm theo tài sản, mã tài sản, địa điểm..."
                      className="pl-9 h-11 border-gray-200"
                    />
                  </div>
                  <Select value={assetLocation} onValueChange={setAssetLocation}>
                    <SelectTrigger className="h-11 w-full md:w-40 border-gray-200">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                        <SelectValue placeholder="Địa điểm" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {heroLocations.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={assetType} onValueChange={setAssetType}>
                    <SelectTrigger className="h-11 w-full md:w-44 border-gray-200">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400 shrink-0" />
                        <SelectValue placeholder="Loại tài sản" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {heroPropertyTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleSearch}
                    className="h-11 px-8 bg-[#1a3a6b] hover:bg-[#152d54] text-white font-medium rounded-lg shrink-0"
                  >
                    Tra cứu
                  </Button>
                </div>
              )}

              {activeTab === "cong-ty" && (
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                  <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex-1 flex items-center justify-between h-11 px-3 rounded-md border border-gray-200 bg-white text-sm text-left hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <span className={companyId ? "text-foreground" : "text-gray-400"}>
                          {companyId
                            ? companies.find((c) => c.id === companyId)?.name
                            : "Chọn công ty đấu giá..."}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <Command>
                        <CommandInput placeholder="Tìm tên công ty..." />
                        <CommandList>
                          <CommandEmpty>Không tìm thấy công ty.</CommandEmpty>
                          <CommandGroup>
                            {companies.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setCompanyId(c.id === companyId ? "" : c.id);
                                  setCompanyOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", companyId === c.id ? "opacity-100" : "opacity-0")} />
                                {c.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Select value={companyLocation} onValueChange={setCompanyLocation}>
                    <SelectTrigger className="h-11 w-full md:w-40 border-gray-200">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                        <SelectValue placeholder="Địa điểm" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {heroLocations.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={companyType} onValueChange={setCompanyType}>
                    <SelectTrigger className="h-11 w-full md:w-44 border-gray-200">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400 shrink-0" />
                        <SelectValue placeholder="Loại tài sản" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {heroPropertyTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleSearch}
                    className="h-11 px-8 bg-[#1a3a6b] hover:bg-[#152d54] text-white font-medium rounded-lg shrink-0"
                  >
                    Tra cứu
                  </Button>
                </div>
              )}

              {activeTab === "chu-tai-san" && (
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={ownerQuery}
                      onChange={(e) => setOwnerQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Tìm tên chủ tài sản, tổ chức..."
                      className="pl-9 h-11 border-gray-200"
                    />
                  </div>
                  <Select value={ownerLocation} onValueChange={setOwnerLocation}>
                    <SelectTrigger className="h-11 w-full md:w-40 border-gray-200">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                        <SelectValue placeholder="Địa điểm" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {heroLocations.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={ownerType} onValueChange={setOwnerType}>
                    <SelectTrigger className="h-11 w-full md:w-44 border-gray-200">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-gray-400 shrink-0" />
                        <SelectValue placeholder="Loại tài sản" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {heroPropertyTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleSearch}
                    className="h-11 px-8 bg-[#1a3a6b] hover:bg-[#152d54] text-white font-medium rounded-lg shrink-0"
                  >
                    Tra cứu
                  </Button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Curved bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-[50px] md:h-[80px]" preserveAspectRatio="none">
            <path d="M0,120 L0,60 Q720,0 1440,60 L1440,120 Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>

      {/* Analytics stats */}
      <section className="container px-4 -mt-6 md:-mt-10 relative z-20">
        <div className="bg-card border border-border rounded-2xl shadow-lg px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y-2 md:divide-y-0 md:divide-x divide-border">
            {analyticsStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 pt-4 md:pt-0 first:pt-0 md:px-6 first:pl-0 last:pr-0">
                  <div className="bg-primary/10 rounded-full shrink-0 flex items-center justify-center w-12 h-12">
                    <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary leading-none mb-0.5">{stat.value}</div>
                    <div className="text-xs text-muted-foreground leading-snug">{stat.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Reward banner — only when user has unclaimed rewards */}
      <HomepageRewardBanner />

      {/* Market Report Teaser */}
      <MarketReportTeaser />

      {/* Auction Section */}
      <AuctionSection />

      {/* Popular Areas */}
      <PopularAreas />

      {/* Auction Categories */}
      <section className="container py-3 md:py-4 px-4">
        <div className="mb-6 md:mb-8">
          <h2 className="text-lg md:text-2xl font-medium text-foreground mb-1">
            Danh mục hàng đấu giá
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">Chọn loại tài sản bạn quan tâm
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-3">
          {auctionCategories.map((type) => {
            const Icon = type.icon;
            return (
              <Link
                key={type.label}
                to={`/listings?propertyType=${type.slug}`}
                className="group flex flex-col items-center gap-1.5 py-4 md:py-5 rounded-xl transition-all cursor-pointer border border-border bg-card hover:border-primary hover:bg-primary/5">
                
                <Icon className="h-6 w-6 md:h-7 md:w-7 transition-colors text-muted-foreground group-hover:text-primary" strokeWidth={1.5} />
                <span className="text-[11px] md:text-xs font-medium text-foreground text-center leading-tight">
                  {type.label}
                </span>
              </Link>);
          })}
        </div>
      </section>

      {/* Featured Auction Companies */}
      <FeaturedProjects />

      {/* Completed Auctions */}
      <CompletedAuctions />




      {/* Partners */}
      <PartnersSection />

      {/* News Section */}
      <NewsSection />

      {/* Route B — B2B entry for auction company owners (hidden) */}

      {/* CTA Section */}
      <section className="container px-4 py-8 md:py-12">
        <div className="relative rounded-2xl bg-gradient-to-br from-[hsl(var(--foreground))] to-[hsl(var(--foreground)/0.85)] overflow-hidden">
          {/* Dot pattern */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--background)) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          {/* Glow accents */}
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative grid md:grid-cols-5 gap-6 items-center px-8 py-12 md:px-14 md:py-16">
            {/* Left content */}
            <div className="md:col-span-3 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/10 border border-background/10 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] font-medium text-background/80">Hợp tác cùng phát triển</span>
              </div>
              <h2 className="text-xl md:text-3xl font-semibold text-background mb-3 leading-tight md:whitespace-nowrap">
                Bạn là tổ chức đấu giá tài sản?
              </h2>
              <p className="text-sm md:text-base text-background/60 max-w-md md:max-w-none mx-auto md:mx-0 md:whitespace-nowrap">
                Trở thành đối tác của chúng tôi để mở rộng mạng lưới đấu giá tài sản trên toàn quốc
              </p>
            </div>

            {/* Right stats + CTA */}
            <div className="md:col-span-2 flex flex-col items-center md:items-end gap-5">
              <div className="flex gap-6 text-center">
                <div>
                  <div className="text-2xl md:text-3xl font-bold text-background">10K+</div>
                  <div className="text-[11px] text-background/50">Nhà đầu tư</div>
                </div>
                <div className="w-px bg-background/15" />
                <div>
                  <div className="text-2xl md:text-3xl font-bold text-background">5K+</div>
                  <div className="text-[11px] text-background/50">Phiên đấu giá</div>
                </div>
                <div className="w-px bg-background/15" />
                <div>
                  <div className="text-2xl md:text-3xl font-bold text-background">98%</div>
                  <div className="text-[11px] text-background/50">Hài lòng</div>
                </div>
              </div>
              <Button
                size="lg"
                className="bg-background text-foreground hover:bg-background/90 shadow-lg shadow-black/20"
                onClick={() => setCollabOpen(true)}>
                <Handshake className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Đăng ký hợp tác
              </Button>
            </div>
          </div>
        </div>
      </section>

      <CollaborationDialog open={collabOpen} onOpenChange={setCollabOpen} />

      <Footer />
    </div>);

};

export default Index;