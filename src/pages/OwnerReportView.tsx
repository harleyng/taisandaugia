import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useOwnerPortfolioMetrics, type PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";
import { PortfolioOverviewBlock } from "@/components/asset-owner-portal/shared/PortfolioOverviewBlock";
import { ReportHeader } from "@/components/asset-owner-portal/report/ReportHeader";
import { ReportLayer2 } from "@/components/asset-owner-portal/report/ReportLayer2";
import { ReportLayer3 } from "@/components/asset-owner-portal/report/ReportLayer3";
import { ReportLayer4 } from "@/components/asset-owner-portal/report/ReportLayer4";

const OwnerReportView = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const stateFilter = (location.state as { filter?: PortfolioFilter } | null)?.filter;
  const filter: PortfolioFilter = stateFilter ?? {};
  const viewedAt = useRef(new Date());

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If no state, someone navigated directly — redirect to filter screen
    if (!location.state) {
      navigate("/chu-tai-san/bao-cao", { replace: true });
      return;
    }

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/chu-tai-san/bao-cao", { replace: true }); return; }
      const { data: ws } = await supabase
        .from("asset_owner_workspaces")
        .select("id")
        .eq("owner_user_id", session.user.id)
        .maybeSingle();
      setWorkspaceId(ws?.id ?? null);
      setLoading(false);
    };
    load();
  }, [location.state, navigate]);

  const { metrics: filteredMetrics, isLoading: filteredLoading } =
    useOwnerPortfolioMetrics(workspaceId, filter);

  const { metrics: allMetrics, isLoading: allLoading } =
    useOwnerPortfolioMetrics(workspaceId, {});

  const isLoading = loading || filteredLoading || allLoading;

  const isDefaultFilter =
    !filter.propertyTypeSlugs?.length &&
    !filter.provinces?.length &&
    !filter.auctionOrgIds?.length &&
    !filter.dateFrom &&
    !filter.dateTo;

  const filterLabel = isDefaultFilter
    ? "Toàn danh mục"
    : [
        filter.propertyTypeSlugs?.join(", "),
        filter.provinces?.join(", "),
        filter.auctionOrgIds?.length ? `${filter.auctionOrgIds.length} TCDG` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Tổ hợp tùy chỉnh";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl print:px-0">
      {/* Report header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground mb-3">
          Báo cáo Chủ tài sản — {filterLabel}
        </h1>
        <ReportHeader filter={filter} viewedAt={viewedAt.current} />
      </div>

      <div className="space-y-8">
        {/* Layer 1 — Overview */}
        <section>
          <h2 className="text-base font-bold text-foreground mb-4">Lớp 1 — Tổng quan</h2>
          <PortfolioOverviewBlock metrics={filteredMetrics} loading={isLoading} />
        </section>

        {/* Layer 2 — Deep analysis */}
        {!isLoading && <ReportLayer2 metrics={filteredMetrics} />}

        {/* Layer 3 — Context comparison */}
        {!isLoading && (
          <ReportLayer3
            metrics={filteredMetrics}
            allMetrics={allMetrics}
            filterLabel={filterLabel}
          />
        )}

        {/* Layer 4 — Schedule & actions */}
        {!isLoading && <ReportLayer4 metrics={filteredMetrics} />}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerReportView;
