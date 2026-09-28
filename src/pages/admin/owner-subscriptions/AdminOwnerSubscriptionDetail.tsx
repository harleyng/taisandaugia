import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, History, Loader2, Send, Settings2, Undo2, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useAdminOwnerSubscriptionDetail,
  useAdminOwnerSubscriptionList,
  useSetOwnerSubscriptionStatus,
} from "@/hooks/useAdminOwnerSubscriptions";
import { SubscriptionStatusBadge } from "@/components/owner-subscription/SubscriptionStatusBadge";
import { SubscriptionSettingsForm } from "@/components/admin/owner-subscriptions/SubscriptionSettingsForm";
import { SubscriptionUsageTab } from "@/components/admin/owner-subscriptions/SubscriptionUsageTab";
import { SubscriptionHistoryTab } from "@/components/admin/owner-subscriptions/SubscriptionHistoryTab";
import { ActivateSubscriptionDialog } from "@/components/admin/owner-subscriptions/ActivateSubscriptionDialog";
import { CancelSubscriptionDialog } from "@/components/admin/owner-subscriptions/CancelSubscriptionDialog";
import { formatSubDate } from "@/lib/ownerSubscription/status";
import { formatMoneyFull } from "@/utils/money";

type Tab = "cau-hinh" | "su-dung" | "lich-su";

/** /admin/goi-thue-bao/:workspaceId — cấu hình, kích hoạt, theo dõi gói của một Trạm. */
export default function AdminOwnerSubscriptionDetail() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "cau-hinh";

  const { data: list } = useAdminOwnerSubscriptionList();
  const { data: detail, isLoading } = useAdminOwnerSubscriptionDetail(workspaceId);
  const setStatus = useSetOwnerSubscriptionStatus();
  const canCreate = useHasAdminPermission("goi-thue-bao", "create");
  const canUpdate = useHasAdminPermission("goi-thue-bao", "update");

  const [activateOpen, setActivateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const row = list?.find((r) => r.workspace_id === workspaceId);
  const sub = detail?.sub ?? null;
  const effective = detail?.status?.status ?? (sub ? (sub.status as never) : null);
  const canEdit = sub ? canUpdate : canCreate;

  return (
    <div className="space-y-5 p-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("/admin/goi-thue-bao")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Gói thuê bao
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
          {sub && canUpdate && (
            <div className="flex flex-wrap items-center gap-2">
              {(sub.status === "draft" || sub.status === "cancelled") && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ subId: sub.id, status: "offered" })}
                >
                  {setStatus.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  Gửi chào gói
                </Button>
              )}
              {sub.status === "offered" && (
                <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ subId: sub.id, status: "draft" })}>
                  <Undo2 className="mr-1.5 h-4 w-4" /> Thu hồi về nháp
                </Button>
              )}
              {sub.status !== "cancelled" && (
                <Button size="sm" onClick={() => setActivateOpen(true)}>
                  <Zap className="mr-1.5 h-4 w-4" /> {sub.status === "active" ? "Gia hạn tay" : "Kích hoạt tay"}
                </Button>
              )}
              {sub.status !== "cancelled" && (
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
      {sub?.status === "draft" && (
        <p className="rounded-xl bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          Gói đang là NHÁP — tổ chức chưa thấy. Bấm "Gửi chào gói" để Trưởng đơn vị thấy và thanh toán online, hoặc "Kích hoạt tay" nếu đã thu tiền ngoài hệ thống.
        </p>
      )}

      {detail?.status?.plan_id && (
        <p className="rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-foreground">
          Theo gói danh mục <span className="font-semibold">{detail.status.plan_name}</span> — Trạm tự mua qua trang Gói dịch vụ.
          Sửa cấu hình ở đây chỉ áp cho Trạm này; lần gia hạn qua danh mục sẽ chép lại cấu hình của gói.
        </p>
      )}
      {detail?.status?.pending && (
        <p className="rounded-xl bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          Đã thanh toán đổi sang gói <span className="font-semibold text-foreground">{detail.status.pending.plan_name}</span>{" "}
          ({detail.status.pending.months} tháng · {formatMoneyFull(detail.status.pending.price_vnd)}) — tự áp dụng từ{" "}
          {formatSubDate(detail.status.pending.from)}.
        </p>
      )}

      {isLoading || !detail ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setParams(v === "cau-hinh" ? {} : { tab: v }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="cau-hinh" className="gap-1.5"><Settings2 className="h-4 w-4" /> Cấu hình</TabsTrigger>
            <TabsTrigger value="su-dung" className="gap-1.5" disabled={!sub}><BarChart3 className="h-4 w-4" /> Sử dụng</TabsTrigger>
            <TabsTrigger value="lich-su" className="gap-1.5" disabled={!sub}><History className="h-4 w-4" /> Lịch sử</TabsTrigger>
          </TabsList>
          <TabsContent value="cau-hinh" className="mt-4 rounded-2xl border bg-card p-5">
            <SubscriptionSettingsForm workspaceId={workspaceId} detail={detail} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="su-dung" className="mt-4">
            <SubscriptionUsageTab detail={detail} />
          </TabsContent>
          <TabsContent value="lich-su" className="mt-4">
            <SubscriptionHistoryTab detail={detail} />
          </TabsContent>
        </Tabs>
      )}

      {sub && (
        <>
          <ActivateSubscriptionDialog
            open={activateOpen}
            onOpenChange={setActivateOpen}
            subId={sub.id}
            defaultMonths={sub.term_months}
            defaultAmount={Number(sub.price_vnd)}
            currentEndsOn={sub.status === "active" ? sub.ends_on : null}
          />
          <CancelSubscriptionDialog open={cancelOpen} onOpenChange={setCancelOpen} subId={sub.id} />
        </>
      )}
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
