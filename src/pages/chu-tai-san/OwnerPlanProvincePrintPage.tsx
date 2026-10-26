import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvinceConsolidatedSheet } from "@/components/asset-owner-portal/auction-plan/province/ProvinceConsolidatedSheet";
import { useAdminUnit } from "@/hooks/useAdminUnits";
import { useOwnerAuditTrack } from "@/hooks/useOwnerAuditLog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceAdminUnitCode } from "@/hooks/useAuctionPlans";
import { useAuctionPlanProvinceOk, useConsolidatedPlanItems } from "@/hooks/useAuctionPlanProvince";
import { consolidatedTotals } from "@/lib/auctionPlan/consolidated";
import { ownerPlanProvinceHref } from "@/lib/auctionPlan/routes";
import { todayIso } from "@/lib/ownerOutcomeReport";

/**
 * Bản in tổng hợp toàn tỉnh — /chu-tai-san/ke-hoach/toan-tinh/in?nam=2026 (§A6 L4).
 *
 * Nằm NGOÀI OwnerPortalLayout (không sidebar / topbar) nhưng vẫn sau
 * ProtectedRoute — cùng khuôn với /chu-tai-san/ke-hoach/:id/in.
 *
 * Nguồn là bản mốc đã phê duyệt của từng đơn vị (`auction_plan_consolidated`),
 * nên tờ giấy này luôn là cam kết ĐÃ KÝ, không phải danh mục đang soạn.
 */
const OwnerPlanProvincePrintPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planYear = Number(params.get("nam")) || new Date().getFullYear();
  const { workspaceId, isLoading: wsLoading } = useOwnerWorkspace();
  const { data: provinceOk, isLoading: okLoading } = useAuctionPlanProvinceOk(workspaceId);
  const consolidated = useConsolidatedPlanItems(workspaceId, planYear, provinceOk === true);
  const { data: wsUnitCode } = useWorkspaceAdminUnitCode(workspaceId);
  const { data: provinceUnit } = useAdminUnit(wsUnitCode ?? undefined);
  const printed = useRef(false);
  const tracked = useRef(false);
  const track = useOwnerAuditTrack();

  const totals = useMemo(() => consolidatedTotals(consolidated.rows), [consolidated.rows]);
  const provinceName = provinceUnit?.name ?? "Đơn vị cấp tỉnh";
  const title = `Tổng hợp kế hoạch đấu giá toàn tỉnh năm ${planYear}`;
  const loading = wsLoading || okLoading || (provinceOk === true && consolidated.isLoading);

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Trạm Điều Hành`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  useEffect(() => {
    if (loading || !provinceOk || tracked.current) return;
    tracked.current = track({ action: "print", title, path: "/chu-tai-san/ke-hoach/toan-tinh" });
  }, [loading, provinceOk, title, track]);

  useEffect(() => {
    if (loading || !provinceOk || printed.current || params.get("auto") !== "1") return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(t);
  }, [loading, provinceOk, params]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!provinceOk) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-base font-semibold text-foreground">
          Bản tổng hợp toàn tỉnh ngoài phạm vi của bạn.
        </p>
        <Button variant="outline" onClick={() => navigate("/chu-tai-san/ke-hoach")}>
          Về kế hoạch của đơn vị
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => navigate(ownerPlanProvinceHref(planYear))}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Về Toàn tỉnh
        </Button>
        <Button className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" strokeWidth={1.5} />
          In / Lưu PDF
        </Button>
      </div>

      <ProvinceConsolidatedSheet
        provinceName={provinceName}
        planYear={planYear}
        units={consolidated.units}
        totals={totals}
        today={todayIso()}
      />
    </div>
  );
};

export default OwnerPlanProvincePrintPage;
