import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanPrintSheet } from "@/components/asset-owner-portal/auction-plan/print/PlanPrintSheet";
import { useAuctionPlan, useAuctionPlanItems } from "@/hooks/useAuctionPlan";
import { usePlanBaselines } from "@/hooks/useAuctionPlanApproval";
import { useAdminUnit, useAdminUnits } from "@/hooks/useAdminUnits";
import { useOwnerAuditTrack } from "@/hooks/useOwnerAuditLog";
import { useWorkspaceBranches } from "@/hooks/useWorkspaceBranches";
import { adminUnitFullLabel } from "@/lib/adminUnits";
import { OWNER_PLANS_HREF, ownerPlanHref } from "@/lib/auctionPlan/routes";
import { planPrintSource } from "@/lib/auctionPlan/print";
import { auctionPlanAutoTitle } from "@/lib/auctionPlan/types";
import { todayIso } from "@/lib/ownerOutcomeReport";

/**
 * Bản in theo mẫu chính thức của một kế hoạch đấu giá —
 * /chu-tai-san/ke-hoach/:id/in (§A9).
 *
 * Nằm NGOÀI OwnerPortalLayout (không sidebar / topbar) nhưng vẫn sau
 * ProtectedRoute — cùng khuôn với /chu-tai-san/bao-cao-dinh-ky/:id/in.
 * `?auto=1` ⇒ tự mở hộp thoại in khi số liệu sẵn sàng.
 *
 * Kế hoạch ĐÃ DUYỆT in theo bản mốc mới nhất; các trạng thái khác in danh mục
 * hiện tại và đóng dấu "BẢN DỰ THẢO" (`planPrintSource`).
 */
const OwnerAuctionPlanPrintPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: plan, isLoading: planLoading } = useAuctionPlan(id);
  const { data: items = [], isLoading: itemsLoading } = useAuctionPlanItems(id);
  const { data: baselines = [], isLoading: baselinesLoading } = usePlanBaselines(id);
  const { branches } = useWorkspaceBranches(plan?.workspace_id ?? null);
  const { data: adminUnit } = useAdminUnit(plan?.admin_unit_code);
  const { data: provinces } = useAdminUnits(null);
  const printed = useRef(false);
  const tracked = useRef(false);
  const track = useOwnerAuditTrack();

  const unitLabel = useMemo(() => {
    if (!plan?.branch_id) return "Toàn đơn vị";
    const branch = branches.find((b) => b.id === plan.branch_id);
    return branch?.display_name || branch?.asset_owner_name || "Chi nhánh";
  }, [plan?.branch_id, branches]);

  const adminUnitLabel = useMemo(() => {
    if (!adminUnit) return null;
    const province = provinces?.find((p) => p.code === adminUnit.parent_code) ?? null;
    return adminUnitFullLabel(adminUnit, province);
  }, [adminUnit, provinces]);

  const source = useMemo(
    () => (plan ? planPrintSource(plan, items, baselines) : null),
    [plan, items, baselines],
  );
  const title = plan ? plan.title?.trim() || auctionPlanAutoTitle(plan.plan_year, unitLabel) : "Kế hoạch đấu giá";
  const loading = planLoading || itemsLoading || baselinesLoading;

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Trạm Điều Hành`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  // Nhật ký: ghi một lượt in mỗi lần mở trang (server bỏ trùng trong 10 phút).
  useEffect(() => {
    if (loading || !plan || tracked.current) return;
    tracked.current = track({ action: "print", title, path: `/chu-tai-san/ke-hoach/${plan.id}` });
  }, [loading, plan, title, track]);

  useEffect(() => {
    if (loading || !source || printed.current || params.get("auto") !== "1") return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(t);
  }, [loading, source, params]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plan || !source) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-base font-semibold text-foreground">Không mở được kế hoạch để in.</p>
        <Button variant="outline" onClick={() => navigate(OWNER_PLANS_HREF)}>
          Về danh sách kế hoạch
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
          onClick={() => navigate(ownerPlanHref(plan.id))}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Về kế hoạch
        </Button>
        <Button className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" strokeWidth={1.5} />
          In / Lưu PDF
        </Button>
      </div>

      <PlanPrintSheet
        plan={plan}
        source={source}
        unitLabel={unitLabel}
        adminUnitLabel={adminUnitLabel}
        today={todayIso()}
      />
    </div>
  );
};

export default OwnerAuctionPlanPrintPage;
