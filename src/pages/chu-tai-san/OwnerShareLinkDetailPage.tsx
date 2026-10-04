import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BarChart3, ChevronLeft, Copy, ExternalLink, Link2Off, Settings2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ShareLinkInfoCard } from "@/components/asset-owner-portal/marketing/share-links/ShareLinkInfoCard";
import { ShareLinkSettingsCard } from "@/components/asset-owner-portal/marketing/share-links/ShareLinkSettingsCard";
import { ShareStatsPanel } from "@/components/asset-owner-portal/marketing/share-links/ShareStatsPanel";
import { ShareLinkDialog } from "@/components/asset-posting/share/ShareLinkDialog";
import { RevokeShareLinkDialog } from "@/components/asset-posting/share/RevokeShareLinkDialog";
import { copyText, useRevokeShareLink } from "@/hooks/usePostingShareLinks";
import { useShareLinkDetail, useShareLinkSeries } from "@/hooks/useShareLinks";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { ownerShareLinksHref, safeOwnerBack } from "@/lib/ownerMarketing/routes";
import { sharedPostingUrl } from "@/lib/postingShare/message";
import { shareLinkState } from "@/lib/postingShare/status";
import { shareTargetOf } from "@/lib/postingShare/types";
import {
  DEFAULT_SHARE_PERIOD,
  SHARE_DEVICES,
  SHARE_PERIODS,
  type ShareDeviceFilter,
  type SharePeriod,
} from "@/lib/shareLinks/series";

const DEFAULTS = { tab: "thong-ke", ky: DEFAULT_SHARE_PERIOD as string, "thiet-bi": "all" };
const ALLOWED = {
  tab: ["thong-ke", "cai-dat"],
  ky: SHARE_PERIODS.map((p) => p.value),
  "thiet-bi": SHARE_DEVICES.map((d) => d.value),
} as const;

function backLabel(back: string | null): string {
  if (back?.startsWith("/chu-tai-san/dang-tai-san/")) return "Quay lại hồ sơ";
  if (back?.includes("/chien-dich/")) return "Quay lại chiến dịch";
  return "Quay lại danh sách link";
}

/**
 * Chi tiết một link Hồ sơ online — /chu-tai-san/truyen-thong/link/:linkId. Chung cho link của
 * hồ sơ số hoá, tin trên sàn, link chiến dịch và link /l/ cũ đã chuyển. Thông tin cơ bản +
 * tab Thống kê (theo ngày) · Cài đặt link.
 */
const OwnerShareLinkDetailPage = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = safeOwnerBack(params.get("tu"));
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);
  const { data: link, isLoading, isError, refetch } = useShareLinkDetail(linkId);
  const series = useShareLinkSeries(linkId, f.ky as SharePeriod, f["thiet-bi"] as ShareDeviceFilter);
  const revoke = useRevokeShareLink();
  const [editing, setEditing] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const goBack = () => navigate(back ?? ownerShareLinksHref());
  const header = (
    <button type="button" onClick={goBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
      {backLabel(back)}
    </button>
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !link) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState
          icon={Link2Off}
          tone={isError ? "destructive" : "muted"}
          title={isError ? "Chưa tải được link." : "Không tìm thấy link"}
          description={isError ? undefined : "Link có thể thuộc đơn vị khác, hoặc nằm ngoài phạm vi chi nhánh của bạn."}
          action={
            isError ? (
              <Button variant="outline" onClick={() => refetch()}>
                Thử lại
              </Button>
            ) : (
              <Button onClick={goBack}>{backLabel(back)}</Button>
            )
          }
        />
      </div>
    );
  }

  const state = shareLinkState(link);
  const manage = !!link.canManage && !!link.code;
  const url = link.code ? sharedPostingUrl(link.code) : null;
  const target = shareTargetOf(link);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {header}
        {manage && url && (
          <div className="flex flex-wrap gap-2">
            {state === "active" && (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={async () =>
                  (await copyText(url)) ? toast.success("Đã sao chép link") : toast.error("Trình duyệt chặn sao chép — hãy thử lại.")
                }
              >
                <Copy className="h-4 w-4" strokeWidth={1.5} />
                Sao chép link
              </Button>
            )}
            <Button variant="outline" className="gap-1.5" onClick={() => window.open(url, "_blank", "noopener")}>
              <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
              Xem như người nhận
            </Button>
            {state !== "revoked" && (
              <Button variant="destructive" className="gap-1.5" onClick={() => setRevoking(true)}>
                <Undo2 className="h-4 w-4" strokeWidth={1.5} />
                Thu hồi link
              </Button>
            )}
          </div>
        )}
      </div>

      <h1 className="text-xl font-semibold text-foreground">
        Chi tiết link — <span className="break-words">{link.label}</span>
      </h1>

      <ShareLinkInfoCard link={link} />

      <Tabs value={f.tab} onValueChange={(v) => setFilter("tab", v)} className="space-y-4">
        <OwnerTabsList aria-label="Mục của link">
          <OwnerTabsTrigger value="thong-ke" icon={BarChart3}>
            Thống kê
          </OwnerTabsTrigger>
          <OwnerTabsTrigger value="cai-dat" icon={Settings2}>
            Cài đặt link
          </OwnerTabsTrigger>
        </OwnerTabsList>
        <TabsContent value="thong-ke" className="mt-0">
          <section className="rounded-2xl bg-card p-5 shadow-card">
            <ShareStatsPanel
              series={series.data}
              isLoading={series.isLoading}
              isError={series.isError}
              onRetry={() => void series.refetch()}
              period={f.ky as SharePeriod}
              device={f["thiet-bi"] as ShareDeviceFilter}
              onPeriod={(v) => setFilter("ky", v)}
              onDevice={(v) => setFilter("thiet-bi", v)}
              followLabel={link.targetKind === "listing" ? "Lưu tài sản" : "Theo dõi phiên"}
            />
          </section>
        </TabsContent>
        <TabsContent value="cai-dat" className="mt-0">
          <ShareLinkSettingsCard link={link} onEdit={manage && state !== "revoked" ? () => setEditing(true) : undefined} />
        </TabsContent>
      </Tabs>

      {manage && (
        <ShareLinkDialog target={target} open={editing} link={link} onClose={() => setEditing(false)} />
      )}
      <RevokeShareLinkDialog
        link={revoking ? link : null}
        pending={revoke.isPending}
        onClose={() => setRevoking(false)}
        onConfirm={(l) => revoke.mutate(l.id, { onSuccess: () => setRevoking(false) })}
      />
    </div>
  );
};

export default OwnerShareLinkDetailPage;
