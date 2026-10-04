import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { channelLabel } from "@/lib/ownerMarketing/links";
import { ownerCampaignHref } from "@/lib/ownerMarketing/routes";
import { ownerPostingPath } from "@/lib/asset-posting/paths";
import { sharedPostingUrl } from "@/lib/postingShare/message";
import {
  SHARE_LINK_STATE_LABEL,
  formatShareDay,
  formatShareDayTime,
  shareLinkState,
  type ShareLinkState,
} from "@/lib/postingShare/status";
import type { PostingShareLink } from "@/lib/postingShare/types";
import { cn } from "@/lib/utils";

const STATE_TONE: Record<ShareLinkState, string> = {
  active: "border-success/30 bg-success/10 text-success",
  expired: "border-warning/40 bg-warning/10 text-foreground",
  revoked: "border-border bg-muted text-muted-foreground",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

const linkBtn = "inline-flex max-w-full items-center gap-1 truncate text-left font-medium text-primary hover:underline";

/** "Thông tin cơ bản" của link — hai cột như thẻ chiến dịch. */
export function ShareLinkInfoCard({ link }: { link: PostingShareLink }) {
  const navigate = useNavigate();
  const state = shareLinkState(link);

  const asset =
    link.targetKind === "posting" && link.postingId ? (
      <button type="button" className={linkBtn} onClick={() => navigate(`${ownerPostingPath(link.postingId!)}?tab=ho-so-online`)}>
        <span className="truncate">{link.targetTitle}</span>
      </button>
    ) : link.listingId ? (
      <a href={`/listings/${link.listingId}`} target="_blank" rel="noopener noreferrer" className={linkBtn}>
        <span className="truncate">{link.targetTitle}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      </a>
    ) : (
      link.targetTitle
    );

  return (
    <section className="rounded-2xl bg-card shadow-card">
      <h2 className="border-b border-border px-5 py-3.5 text-base font-semibold text-foreground">Thông tin cơ bản</h2>
      <div className="grid gap-x-8 px-5 py-3 md:grid-cols-2 md:divide-x md:divide-border">
        <dl>
          <Row label="Gửi cho">{link.label}</Row>
          <Row label="Tài sản">
            <span className="flex min-w-0 flex-col">
              {asset}
              <span className="truncate text-xs text-muted-foreground">
                {[link.targetKind === "posting" ? "Hồ sơ số hoá" : "Tin trên sàn", link.targetCode, link.branchName]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </Row>
          <Row label="Kênh">{channelLabel(link.channel)}</Row>
          <Row label="Chiến dịch">
            {link.campaignId ? (
              <button type="button" className={linkBtn} onClick={() => navigate(ownerCampaignHref(link.campaignId!))}>
                {link.campaignName ?? "Chiến dịch"}
              </button>
            ) : (
              <span className="text-muted-foreground">Tạo riêng (không thuộc chiến dịch)</span>
            )}
          </Row>
        </dl>
        <dl className="md:pl-8">
          <Row label="Trạng thái">
            <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", STATE_TONE[state])}>
              {SHARE_LINK_STATE_LABEL[state]}
            </span>
          </Row>
          <Row label="Thời gian tạo">{formatShareDayTime(link.createdAt)}</Row>
          <Row label="Người tạo">{link.createdByName ?? "—"}</Row>
          <Row label="Người gửi">
            {link.senderName ?? "—"}
            {link.senderPhone && <span className="text-muted-foreground"> · {link.senderPhone}</span>}
          </Row>
          <Row label="Hết hạn">
            {state === "revoked"
              ? `Đã thu hồi ${formatShareDay(link.revokedAt)}`
              : link.expiresAt
                ? formatShareDay(link.expiresAt)
                : "Không hết hạn"}
          </Row>
        </dl>
      </div>
      {link.code && (
        <p className="break-all border-t border-border px-5 py-3 text-xs text-muted-foreground">
          {sharedPostingUrl(link.code)}
          {link.isLegacy && " · chuyển từ link theo dõi cũ (link /l/ đã gửi vẫn mở về trang này)"}
        </p>
      )}
    </section>
  );
}
