import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LayoutDashboard, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useOwnerPortfolioMetrics } from "@/hooks/useOwnerPortfolioMetrics";
import { PortfolioOverviewBlock } from "@/components/asset-owner-portal/shared/PortfolioOverviewBlock";
import { UpcomingAuctionsBlock } from "@/components/asset-owner-portal/dashboard/UpcomingAuctionsBlock";
import { PendingConfirmationsBlock } from "@/components/asset-owner-portal/dashboard/PendingConfirmationsBlock";
import { StuckAssetsBlock } from "@/components/asset-owner-portal/dashboard/StuckAssetsBlock";
import type { ListingRow } from "@/hooks/useOwnerPortfolioMetrics";

const OwnerDashboard = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data: ws } = await supabase
        .from("asset_owner_workspaces")
        .select("id")
        .eq("owner_user_id", session.user.id)
        .maybeSingle();

      if (ws) setWorkspaceId(ws.id);
      setLoading(false);
    };
    load();
  }, []);

  const queryClient = useQueryClient();
  const { metrics, isLoading: metricsLoading } = useOwnerPortfolioMetrics(workspaceId, {});

  // Dev-only: seed pending_confirmation claims
  const [seeding, setSeeding] = useState(false);
  const seedPendingClaims = async () => {
    if (!workspaceId) return;
    setSeeding(true);
    try {
      // Fetch lowest-confidence auto_claimed or confirmed claims
      const { data: candidates, error: fetchErr } = await supabase
        .from("asset_owner_claims")
        .select("id, confidence_score, status")
        .eq("workspace_id", workspaceId)
        .in("status", ["auto_claimed", "confirmed"])
        .order("confidence_score", { ascending: true })
        .limit(6);
      if (fetchErr) throw fetchErr;
      if (!candidates?.length) { toast.info("Không có claim nào để seed"); return; }

      // Take up to 5 lowest-confidence claims
      const toUpdate = candidates.slice(0, 5).map((c) => c.id);
      const { error: updateErr } = await supabase
        .from("asset_owner_claims")
        .update({ status: "pending_confirmation" })
        .in("id", toUpdate);
      if (updateErr) throw updateErr;

      toast.success(`Đã cập nhật ${toUpdate.length} claim → chờ xác nhận`);
      queryClient.invalidateQueries({ queryKey: ["pending-claims-dashboard", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["owner-portfolio-claims", workspaceId] });
    } catch (e) {
      toast.error("Seed thất bại: " + String(e));
    } finally {
      setSeeding(false);
    }
  };

  // Direct query for pending_confirmation claims — bypasses metrics join issue
  const { data: pendingClaims = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-claims-dashboard", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select(`
          id, confidence_score, matched_name,
          listing:listings(id, title, price, image_url, address, custom_attributes)
        `)
        .eq("workspace_id", workspaceId!)
        .eq("status", "pending_confirmation")
        .order("confidence_score", { ascending: true })
        .limit(5);
      if (error) throw error;
      return (data ?? []).filter((c) => c.listing !== null);
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60_000,
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pendingItems: ListingRow[] = pendingClaims.map((c): ListingRow => {
    const l = c.listing as any;
    return {
      id: l?.id ?? c.id,
      title: l?.title ?? "—",
      price: Number(l?.price ?? 0),
      priceUnit: "TOTAL",
      listingStatus: "",
      sessionStatus: "",
      propertyTypeSlug: "",
      province: "",
      auctionOrgId: null,
      auctionOrgName: null,
      winPrice: null,
      auctionTime: l?.custom_attributes?.auction_time ?? l?.custom_attributes?.auction_date ?? null,
      registrationDeadline: null,
      imageUrl: l?.image_url ?? null,
      roundCount: 0,
      priceHistory: [],
      legalStatus: null,
      matchedName: c.matched_name ?? null,
      claimStatus: "pending_confirmation",
      confidenceScore: c.confidence_score ?? null,
    };
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ─── Guards ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <div className="text-center space-y-4 max-w-sm">
          <div className="p-3 rounded-xl bg-primary/10 w-fit mx-auto">
            <LayoutDashboard className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">
            Bạn chưa có workspace Chủ tài sản.
          </p>
          <Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>
            Bắt đầu KYC
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Dev seed button */}
      {import.meta.env.DEV && workspaceId && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-muted-foreground border-dashed"
            onClick={seedPendingClaims}
            disabled={seeding}
          >
            <FlaskConical className="w-3 h-3" />
            {seeding ? "Đang seed..." : "Seed: chờ xác nhận"}
          </Button>
        </div>
      )}

      {/* KPI overview */}
      <PortfolioOverviewBlock metrics={metrics} loading={metricsLoading} />

      {/* Cuộc đấu giá sắp tới — full width */}
      <UpcomingAuctionsBlock listings={metrics.allListings} loading={metricsLoading} />

      {/* Tài sản chờ xác nhận + Tài sản tồn đọng — two-column row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PendingConfirmationsBlock
          items={pendingItems}
          totalCount={pendingItems.length}
          loading={pendingLoading}
        />
        <StuckAssetsBlock items={metrics.pendingAssets} loading={metricsLoading} />
      </div>
    </div>
  );
};

export default OwnerDashboard;
