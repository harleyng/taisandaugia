import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SearchBar } from "@/components/SearchBar";
import { AuctionSection } from "@/components/AuctionSection";
import { CompletedAuctions } from "@/components/CompletedAuctions";
import { FeaturedProjects } from "@/components/FeaturedProjects";
import { PopularAreas } from "@/components/PopularAreas";
import { SupportTools } from "@/components/SupportTools";
import { NewsSection } from "@/components/NewsSection";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Home, LandPlot, MapPin, Building, Landmark } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-image.jpg";

const auctionCategories = [
{ label: "Quyền sử dụng đất", slug: "quyen-su-dung-dat", icon: LandPlot },
{ label: "Nhà riêng lẻ", slug: "nha-rieng-le", icon: Home },
{ label: "Căn hộ", slug: "can-ho", icon: Building2 },
{ label: "Đất dự án", slug: "dat-du-an", icon: MapPin },
{ label: "Thi hành án", slug: "thi-hanh-an", icon: Landmark },
{ label: "Tài sản công", slug: "tai-san-cong", icon: Building }];


const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero Section - gradient background with integrated search */}
      <section className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Bất động sản"
          className="absolute inset-0 w-full h-full object-cover" />
        
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative container px-4 pt-32 pb-36 md:pt-44 md:pb-52">
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-[40px] md:text-[56px] font-bold text-white mb-3 leading-tight">
              Săn tài sản đấu giá toàn quốc
            </h1>
            <p className="text-lg md:text-2xl text-white/80 max-w-2xl mx-auto leading-relaxed">
              Tra cứu nhanh – Thông tin minh bạch – Cập nhật liên tục
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <SearchBar variant="hero" />
          </div>
        </div>
        {/* Curved bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-[50px] md:h-[80px]" preserveAspectRatio="none">
            <path d="M0,120 L0,60 Q720,0 1440,60 L1440,120 Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>

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

      {/* Support Tools */}
      <SupportTools />

      {/* News Section */}
      <NewsSection />

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
                onClick={() => navigate("/broker/properties/new")}>
                Liên hệ hợp tác
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>);

};

export default Index;