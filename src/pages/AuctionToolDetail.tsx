import { Link, useParams } from "react-router-dom";
import { ChevronRight, Globe } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { OwnershipBadge } from "@/components/admin/auction-tools/ProviderStatusBadge";
import { ShowcaseGallery } from "@/components/auction-tools/ShowcaseGallery";
import { UseServiceCTA } from "@/components/auction-tools/UseServiceCTA";
import { useProviderBySlug } from "@/hooks/usePublicAuctionTools";

export default function AuctionToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: provider, isLoading } = useProviderBySlug(slug);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container flex-1 px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/cong-cu-dau-gia" className="hover:text-foreground">Công cụ đấu giá</Link>
          <ChevronRight className="h-4 w-4" />
          {isLoading ? <Skeleton className="h-4 w-24" /> : <span className="text-foreground">{provider?.name ?? "—"}</span>}
        </nav>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}

        {!isLoading && !provider && (
          <div className="rounded-2xl border border-border p-10 text-center">
            <p className="text-muted-foreground">Không tìm thấy đơn vị cung cấp.</p>
            <Link to="/cong-cu-dau-gia" className="mt-3 inline-block text-primary hover:underline">
              ← Về danh sách công cụ
            </Link>
          </div>
        )}

        {!isLoading && provider && (
          <>
            {/* Header card */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  {provider.logo_url ? (
                    <img src={provider.logo_url} alt={provider.name} className="h-16 w-16 rounded-xl object-contain" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-2xl font-bold text-primary">
                      {provider.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-foreground">{provider.name}</h1>
                      <OwnershipBadge isOwn={provider.is_own} />
                    </div>
                    {provider.tool && (
                      <p className="text-sm text-muted-foreground">{provider.tool.name}</p>
                    )}
                    {provider.tagline && (
                      <p className="mt-1 max-w-xl text-muted-foreground">{provider.tagline}</p>
                    )}
                    {provider.website && (
                      <a
                        href={provider.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <Globe className="h-4 w-4" />
                        Website
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  {provider.price_label && (
                    <span className="text-sm font-medium text-muted-foreground">{provider.price_label}</span>
                  )}
                  <UseServiceCTA provider={provider} />
                </div>
              </div>
            </div>

            {/* Giới thiệu */}
            {provider.description && (
              <div className="mt-6 rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-2 text-lg font-semibold text-foreground">Giới thiệu</h2>
                <p className="whitespace-pre-line text-muted-foreground">{provider.description}</p>
              </div>
            )}

            {/* Showcase */}
            <div className="mt-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Showcase</h2>
              <ShowcaseGallery providerId={provider.id} />
            </div>

            {/* CTA cuối */}
            <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-border bg-primary/5 p-8 text-center">
              <p className="text-lg font-semibold text-foreground">Quan tâm đến dịch vụ này?</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Gửi yêu cầu để đội ngũ tư vấn liên hệ và hỗ trợ bạn.
              </p>
              <UseServiceCTA provider={provider} className="mt-1" />
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
