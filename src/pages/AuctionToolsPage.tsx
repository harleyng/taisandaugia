import { useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolProviderCard } from "@/components/auction-tools/ToolProviderCard";
import { toolIcon } from "@/lib/auctionTools/toolIcon";
import { usePublicTools } from "@/hooks/usePublicAuctionTools";
import type { AuctionToolProvider } from "@/types/auctionTools";

export default function AuctionToolsPage() {
  const { data, isLoading } = usePublicTools();

  const providersByTool = useMemo(() => {
    const map: Record<string, AuctionToolProvider[]> = {};
    for (const p of data?.providers ?? []) (map[p.tool_id] ??= []).push(p);
    return map;
  }, [data]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
          <div className="container px-4 py-12 text-center">
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Công cụ đấu giá</h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Các dịch vụ hỗ trợ toàn trình cho hoạt động đấu giá — số hoá tài sản, định giá,
              hỗ trợ vay vốn và tư vấn pháp lý — từ Tài Sản Đấu Giá và các đối tác uy tín.
            </p>
          </div>
        </section>

        <div className="container space-y-12 px-4 py-10">
          {isLoading &&
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-7 w-48" />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, j) => <Skeleton key={j} className="h-40 rounded-2xl" />)}
                </div>
              </div>
            ))}

          {!isLoading && (data?.tools ?? []).map((tool) => {
            const Icon = toolIcon(tool.icon);
            const providers = providersByTool[tool.id] ?? [];
            return (
              <section key={tool.id} id={tool.slug} className="scroll-mt-20">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{tool.name}</h2>
                    {tool.tagline && <p className="text-sm text-muted-foreground">{tool.tagline}</p>}
                  </div>
                </div>

                {providers.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Đang cập nhật đơn vị cung cấp.
                  </p>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {providers.map((p) => <ToolProviderCard key={p.id} provider={p} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
