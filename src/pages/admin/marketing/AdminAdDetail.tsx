import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdvertisement } from "@/hooks/useAdvertisements";
import { AdActions } from "@/components/admin/advertising/AdActions";
import { AdDetailHeader } from "@/components/admin/advertising/detail/AdDetailHeader";
import { AdLinkedOrders } from "@/components/admin/advertising/detail/AdLinkedOrders";
import { AdStatsTab } from "@/components/admin/advertising/detail/AdStatsTab";
import { AdContentTab } from "@/components/admin/advertising/detail/AdContentTab";

export default function AdminAdDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "stats";

  const { data: ad, isLoading } = useAdvertisement(id);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Không tìm thấy chiến dịch.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/admin/marketing/quang-cao")}>
          Về danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/marketing/quang-cao")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">Chi tiết chiến dịch</h1>
          <p className="text-xs text-muted-foreground font-mono">
            {ad.code ?? `#${ad.id.slice(0, 8).toUpperCase()}`}
          </p>
        </div>
        <AdActions ad={ad} layout="buttons" afterDelete={() => navigate("/admin/marketing/quang-cao")} />
      </div>

      <AdDetailHeader ad={ad} />

      <AdLinkedOrders adId={ad.id} />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="mt-5">
        <TabsList>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Thống kê
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5">
            <FileText className="h-4 w-4" /> Nội dung chiến dịch
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stats" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <AdStatsTab ad={ad} />
          </div>
        </TabsContent>
        <TabsContent value="content" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <AdContentTab ad={ad} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
