import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, History, Package, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useAdminSubCatalog,
  useAdminOwnerSubscriptionDetail,
  useAdminOwnerSubscriptionList,
} from "@/hooks/useAdminOwnerSubscriptions";
import { SubscriptionStatusBadge } from "@/components/owner-subscription/SubscriptionStatusBadge";
import { SubscriptionPlanTab } from "@/components/admin/owner-subscriptions/SubscriptionPlanTab";
import { SubscriptionUsageTab } from "@/components/admin/owner-subscriptions/SubscriptionUsageTab";
import { SubscriptionHistoryTab } from "@/components/admin/owner-subscriptions/SubscriptionHistoryTab";
import {
  ActivateSubscriptionDialog,
  type ActivateCurrentSub,
} from "@/components/admin/owner-subscriptions/ActivateSubscriptionDialog";
import { CancelSubscriptionDialog } from "@/components/admin/owner-subscriptions/CancelSubscriptionDialog";
import { packageTerms } from "@/lib/ownerSubscription/packages";
import { formatSubDate } from "@/lib/ownerSubscription/status";
import type { SubStatus } from "@/lib/ownerSubscription/types";
import { formatMoneyFull } from "@/utils/money";

type Tab = "goi" | "su-dung" | "lich-su";

/** /admin/goi-thue-bao/ap-dung/:workspaceId — gói của một Trạm: xem, kích hoạt tay theo gói danh mục, huỷ. */
export default function AdminOwnerSubscriptionDetail() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "goi";

  const { data: list } = useAdminOwnerSubscriptionList();
  const { data: detail, isLoading } = useAdminOwnerSubscriptionDetail(workspaceId);
  const { data: catalog } = useAdminSubCatalog();
  const canUpdate = useHasAdminPermission("goi-thue-bao", "update");

  const [activateOpen, setActivateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const row = list?.find((r) => r.workspace_id === workspaceId);
  const sub = detail?.sub ?? null;
  const effective = (detail?.status?.status ?? (sub ? sub.status : null)) as SubStatus | null;

  // Gói Trạm được mua = gói của bộ gói của Trạm (bộ được gán, chưa gán thì bộ mặc định).
  const pkg = catalog?.packages.find((k) => k.id === row?.package_id) ?? null;
  const allowedPlans = pkg?.plans ?? [];
  const activatablePlans = useMemo(() => (pkg?.is_active ? pkg.plans.filter((p) => p.is_active) : []), [pkg]);
  const pkgTerms = useMemo(
    () =>
      packageTerms(pkg?.term_ids ?? [], catalog?.terms ?? []).map((t) => ({
        months: t.months,
        discount_pct: t.discount_pct,
        is_active: true,
      })),
    [pkg, catalog?.terms],
  );
  const current = useMemo<ActivateCurrentSub | null>(
    () =>
      sub
        ? {
            planId: detail?.status?.plan_id ?? null,
            planName: sub.plan_name,
            status: effective,
            endsOn: sub.ends_on,
            termMonths: sub.term_months,
            hasPending: !!detail?.status?.pending,
          }
        : null,
    [sub, detail?.status, effective],
  );

  const running = effective === "active" || effective === "scheduled";

  return (
    <div className="space-y-5 p-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("/admin/goi-thue-bao/ap-dung")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Trạm đăng ký
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{row?.workspace_name ?? "Trạm"}</h1>
              <SubscriptionStatusBadge status={effective} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Trưởng đơn vị: {row?.owner_name || "—"} {row?.owner_email ? `· ${row.owner_email}` : ""}
              {row ? ` · ${row.member_count} thành viên` : ""}
            </p>
          </div>
          {canUpdate && detail && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setActivateOpen(true)}>
                <Zap className="mr-1.5 h-4 w-4" /> {running ? "Gia hạn / đổi gói tay" : "Kích hoạt tay"}
              </Button>
              {sub && sub.status !== "cancelled" && (
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}>
                  <XCircle className="mr-1.5 h-4 w-4" /> Huỷ gói
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {sub && (
        <div className="grid gap-3 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-4">
          <Stat label="Mã gói" value={sub.code ?? "—"} />
          <Stat label="Giá mỗi kỳ" value={`${formatMoneyFull(sub.price_vnd)} · ${sub.term_months} tháng`} />
          <Stat label="Hiệu lực" value={sub.starts_on ? `${formatSubDate(sub.starts_on)} – ${formatSubDate(sub.ends_on)}` : "Chưa kích hoạt"} />
          <Stat label="Lý do huỷ" value={sub.status === "cancelled" ? sub.cancel_reason ?? "—" : "—"} />
        </div>
      )}

      {isLoading || !detail ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParams(v === "goi" ? {} : { tab: v }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="goi" className="gap-1.5"><Package className="h-4 w-4" /> Gói</TabsTrigger>
            <TabsTrigger value="su-dung" className="gap-1.5" disabled={!sub}><BarChart3 className="h-4 w-4" /> Sử dụng</TabsTrigger>
            <TabsTrigger value="lich-su" className="gap-1.5" disabled={!sub}><History className="h-4 w-4" /> Lịch sử</TabsTrigger>
          </TabsList>
          <TabsContent value="goi" className="mt-4">
            <SubscriptionPlanTab detail={detail} pkg={pkg} allowedPlans={allowedPlans} />
          </TabsContent>
          <TabsContent value="su-dung" className="mt-4">
            <SubscriptionUsageTab detail={detail} />
          </TabsContent>
          <TabsContent value="lich-su" className="mt-4">
            <SubscriptionHistoryTab detail={detail} />
          </TabsContent>
        </Tabs>
      )}

      <ActivateSubscriptionDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        workspaceId={workspaceId}
        plans={activatablePlans}
        terms={pkgTerms}
        current={current}
      />
      {sub && <CancelSubscriptionDialog open={cancelOpen} onOpenChange={setCancelOpen} subId={sub.id} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
