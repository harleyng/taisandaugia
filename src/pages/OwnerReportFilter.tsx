import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuthState } from "@/hooks/useAuthState";
import { useOwnerPortfolioMetrics, type PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";
import { useOwnerReportAccess } from "@/hooks/useOwnerReportAccess";
import { useCredits } from "@/hooks/useCredits";
import { FilterDimensions } from "@/components/asset-owner-portal/report-filter/FilterDimensions";
import { ReportConfirmDialog } from "@/components/asset-owner-portal/report-filter/ReportConfirmDialog";
import { OWNER_REPORT_COST } from "@/lib/credits";

const OwnerReportFilter = () => {
  const navigate = useNavigate();
  const { session } = useAuthState();

  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PortfolioFilter>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) { setLoading(false); return; }
      const { data: ws } = await supabase
        .from("asset_owner_workspaces")
        .select("id")
        .eq("owner_user_id", s.user.id)
        .maybeSingle();
      setWorkspaceId(ws?.id ?? null);
      setLoading(false);
    };
    load();
  }, []);

  const { metrics, isLoading: metricsLoading } = useOwnerPortfolioMetrics(workspaceId, {});
  const { charge } = useOwnerReportAccess(workspaceId ?? "");
  const { balance } = useCredits();

  const isDefaultFilter =
    !filter.propertyTypeSlugs?.length &&
    !filter.provinces?.length &&
    !filter.auctionOrgIds?.length &&
    !filter.dateFrom &&
    !filter.dateTo;

  const handleView = () => {
    if (isDefaultFilter) {
      navigate("/chu-tai-san/bao-cao/view", { state: { filter: {} } });
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    charge.mutate(
      { filter, isDefault: false },
      {
        onSuccess: (result) => {
          setConfirmOpen(false);
          if (!result.ok) {
            toast.error("Không đủ tín dụng. Vui lòng nạp thêm.");
            return;
          }
          navigate("/chu-tai-san/bao-cao/view", { state: { filter } });
        },
        onError: () => {
          setConfirmOpen(false);
          toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
        },
      },
    );
  };

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
            <FileBarChart className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
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
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <FileBarChart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Chọn tổ hợp báo cáo</h1>
          <p className="text-sm text-muted-foreground">
            Bộ lọc mặc định (toàn bộ) miễn phí · Tùy chỉnh:{" "}
            <span className="font-medium text-foreground">{OWNER_REPORT_COST} tín dụng / lần</span>
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-6">
        {metricsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <FilterDimensions
            filter={filter}
            onChange={setFilter}
            availablePropertyTypes={metrics.availablePropertyTypes}
            availableProvinces={metrics.availableProvinces}
            availableOrgs={metrics.availableOrgIds}
          />
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {isDefaultFilter ? (
              <span className="text-success font-medium">Miễn phí — toàn bộ danh mục</span>
            ) : (
              <span>
                Phí:{" "}
                <span className="font-semibold text-foreground">{OWNER_REPORT_COST} tín dụng</span>
                {session && (
                  <span className="text-muted-foreground ml-1">
                    (số dư: {balance})
                  </span>
                )}
              </span>
            )}
          </div>
          <Button onClick={handleView} disabled={charge.isPending}>
            {charge.isPending ? "Đang xử lý..." : "Xem báo cáo →"}
          </Button>
        </div>
      </Card>

      <ReportConfirmDialog
        open={confirmOpen}
        filter={filter}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        isLoading={charge.isPending}
      />
    </div>
  );
};

export default OwnerReportFilter;
