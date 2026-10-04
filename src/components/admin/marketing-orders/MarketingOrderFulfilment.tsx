import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, ExternalLink, Image as ImageIcon, Mail, Rocket, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailRow, NoteBox, SectionCard, Wide } from "@/components/admin/service-requests/DetailSection";
import { formatWhen } from "@/lib/serviceRequests/form";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import {
  useAdminLinkMarketingOrder,
  useAdminMarketingOrderResults,
  useAdminSetPostMetrics,
  type AdminMarketingOrder,
} from "@/hooks/useAdminMarketingOrders";
import { parsePostMetrics } from "@/lib/ownerMarketing/orderReport";
import { PostMetricsDialog } from "./PostMetricsDialog";

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-US");

/**
 * Thẻ "Thực hiện": thứ sàn dùng để làm đơn — chiến dịch email (chỉ gói trọn chiến dịch, vì email tới
 * người mua trên sàn đang hoãn), banner (gói banner / trọn gói), cờ nổi bật, link bài đăng MXH.
 * Tạo mới mở trình soạn có sẵn với ?mkt_order= — lưu xong tự gắn lại vào đơn.
 */
export function MarketingOrderFulfilment({ order: o, canUpdate }: { order: AdminMarketingOrder; canUpdate: boolean }) {
  const navigate = useNavigate();
  const canEmail = useHasAdminPermission("email", "create");
  const canAds = useHasAdminPermission("quang-cao", "create");
  const link = useAdminLinkMarketingOrder();
  const setMetrics = useAdminSetPostMetrics();
  const [editingMetrics, setEditingMetrics] = useState(false);
  const started = o.status === "in_progress" || o.status === "completed";
  const { data: r } = useAdminMarketingOrderResults(o.id, started);
  const editable = canUpdate && o.status === "in_progress";

  // Ổn định tham chiếu: hộp nhập đặt lại ô theo `initial` mỗi khi nó đổi.
  const postMetrics = useMemo(() => parsePostMetrics(o.post_metrics), [o.post_metrics]);
  const usesEmail = o.variant_key === "mkt_full_owner";
  const usesBanner = o.variant_key === "mkt_banner_owner" || o.variant_key === "mkt_full_owner";

  if (!started) {
    return (
      <SectionCard title="Thực hiện">
        <NoteBox>Nhận việc sau khi khách đã thanh toán để bắt đầu thực hiện.</NoteBox>
      </SectionCard>
    );
  }

  const unlink = (kind: "campaign" | "advertisement") => link.mutate({ orderId: o.id, kind, targetId: null });

  return (
    <SectionCard title="Thực hiện">
      {o.variant_key === "mkt_featured_owner" && (
        <>
          <DetailRow
            label="Nổi bật"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Rocket className="h-3.5 w-3.5 text-primary" />
                {r?.featured?.active ? "Đang hiển thị" : "Đã hết hạn"}
              </span>
            }
          />
          <DetailRow label="Từ" value={formatWhen(o.featured_from)} />
          <DetailRow label="Đến" value={formatWhen(o.featured_until)} />
        </>
      )}

      {usesEmail && (
        <Wide>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Chiến dịch email</p>
              <p className="text-sm font-medium text-foreground">
                {r?.campaign
                  ? `${r.campaign.name} · gửi ${n(r.campaign.sent)} · mở ${n(r.campaign.opened)} · bấm ${n(r.campaign.clicked)}`
                  : "Chưa gắn"}
              </p>
            </div>
            <div className="flex gap-2">
              {o.marketing_campaign_id ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/marketing/email/${o.marketing_campaign_id}`)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Mở
                  </Button>
                  {editable && (
                    <Button size="sm" variant="ghost" disabled={link.isPending} onClick={() => unlink("campaign")}>
                      <Unlink className="mr-1.5 h-3.5 w-3.5" /> Bỏ gắn
                    </Button>
                  )}
                </>
              ) : (
                editable &&
                canEmail && (
                  <Button size="sm" onClick={() => navigate(`/admin/marketing/email/new?mkt_order=${o.id}`)}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" /> Tạo chiến dịch email từ đơn
                  </Button>
                )
              )}
            </div>
          </div>
        </Wide>
      )}

      {usesBanner && (
        <Wide>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Banner</p>
              <p className="text-sm font-medium text-foreground">
                {r?.advertisement
                  ? `${r.advertisement.name} · xem ${n(r.advertisement.views)} · bấm ${n(r.advertisement.clicks)}`
                  : "Chưa gắn"}
              </p>
            </div>
            <div className="flex gap-2">
              {o.advertisement_id ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/marketing/quang-cao/${o.advertisement_id}`)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Mở
                  </Button>
                  {editable && (
                    <Button size="sm" variant="ghost" disabled={link.isPending} onClick={() => unlink("advertisement")}>
                      <Unlink className="mr-1.5 h-3.5 w-3.5" /> Bỏ gắn
                    </Button>
                  )}
                </>
              ) : (
                editable &&
                canAds && (
                  <Button size="sm" onClick={() => navigate(`/admin/marketing/quang-cao/new?mkt_order=${o.id}`)}>
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Tạo banner từ đơn
                  </Button>
                )
              )}
            </div>
          </div>
        </Wide>
      )}

      {o.post_url && (
        <DetailRow
          label="Bài đăng"
          value={
            <a href={o.post_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Mở bài đăng
            </a>
          }
        />
      )}
      {(o.variant_key === "mkt_social_owner" || o.post_url) && (
        <Wide>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Số liệu bài đăng (chủ tài sản thấy)</p>
              <p className="text-sm font-medium text-foreground">
                {postMetrics
                  ? `Tiếp cận ${n(postMetrics.reach)} · tương tác ${n(postMetrics.engagements)} · bấm ${n(postMetrics.clicks)}`
                  : "Chưa nhập"}
              </p>
            </div>
            {canUpdate && (
              <Button size="sm" variant="outline" onClick={() => setEditingMetrics(true)}>
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> {postMetrics ? "Sửa số liệu" : "Nhập số liệu"}
              </Button>
            )}
          </div>
          <PostMetricsDialog
            open={editingMetrics}
            onOpenChange={setEditingMetrics}
            code={o.code}
            initial={postMetrics}
            isPending={setMetrics.isPending}
            onSubmit={(v) => setMetrics.mutateAsync({ orderId: o.id, ...v })}
          />
        </Wide>
      )}
      {o.result_note && <NoteBox>{o.result_note}</NoteBox>}
      {o.variant_key === "mkt_social_owner" && o.status === "in_progress" && (
        <NoteBox>Đăng bài trên fanpage của sàn rồi bấm "Hoàn tất" và dán link bài đăng.</NoteBox>
      )}
    </SectionCard>
  );
}
