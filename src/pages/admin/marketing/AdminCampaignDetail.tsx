import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampaign } from "@/hooks/useCampaigns";
import { CampaignActions } from "@/components/admin/marketing/CampaignActions";
import { CampaignDetailHeader } from "@/components/admin/marketing/detail/CampaignDetailHeader";
import { StatsTab } from "@/components/admin/marketing/detail/StatsTab";
import { ContentTab } from "@/components/admin/marketing/detail/ContentTab";
import { DistributionTab } from "@/components/admin/marketing/detail/DistributionTab";

export default function AdminCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "stats";

  const { data: campaign, isLoading } = useCampaign(id);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Không tìm thấy chiến dịch.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/admin/marketing/email")}>
          Về danh sách
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/marketing/email")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">
            Chi tiết chiến dịch
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            #{campaign.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <CampaignActions
          campaign={campaign}
          layout="buttons"
          afterDelete={() => navigate("/admin/marketing/email")}
        />
      </div>

      <CampaignDetailHeader campaign={campaign} />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="mt-5">
        <TabsList>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Thống kê
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5">
            <FileText className="h-4 w-4" /> Nội dung
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-1.5">
            <Share2 className="h-4 w-4" /> Phân phối
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stats" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <StatsTab campaign={campaign} />
          </div>
        </TabsContent>
        <TabsContent value="content" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <ContentTab campaign={campaign} />
          </div>
        </TabsContent>
        <TabsContent value="distribution" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <DistributionTab campaign={campaign} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
