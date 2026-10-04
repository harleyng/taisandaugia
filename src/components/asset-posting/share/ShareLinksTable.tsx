import { useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, ExternalLink, FileText, Megaphone, MessageCircle, MoreHorizontal, Pencil, QrCode, Store, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyText, useRevokeShareLink } from "@/hooks/usePostingShareLinks";
import { areaOf } from "@/lib/asset-posting/postingPrint";
import { channelLabel } from "@/lib/ownerMarketing/links";
import { shareLinkHref } from "@/lib/ownerMarketing/routes";
import { buildZaloMessage, sharedPostingUrl } from "@/lib/postingShare/message";
import {
  SHARE_LINK_STATE_LABEL,
  formatShareDayTime,
  shareLinkState,
  shareLinkStateNote,
  type ShareLinkState,
} from "@/lib/postingShare/status";
import type { PostingShareLink } from "@/lib/postingShare/types";
import { cn } from "@/lib/utils";
import type { AssetPosting } from "@/types/asset-posting";
import { RevokeShareLinkDialog } from "./RevokeShareLinkDialog";

const STATE_TONE: Record<ShareLinkState, string> = {
  active: "bg-success/10 text-success",
  expired: "bg-warning/10 text-foreground",
  revoked: "bg-muted text-muted-foreground",
};

const n = (v: number) => v.toLocaleString("en-US");
const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40);

async function downloadShareQr(link: Pick<PostingShareLink, "code" | "label" | "targetCode">) {
  if (!link.code) return;
  try {
    const dataUrl = await QRCode.toDataURL(sharedPostingUrl(link.code), { width: 768, margin: 2, errorCorrectionLevel: "M" });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `QR-${slug(link.targetCode ?? "ho-so")}-${slug(link.label)}.png`;
    a.click();
  } catch {
    toast.error("Không tạo được mã QR. Vui lòng thử lại.");
  }
}

/** Tin nhắn Zalo của link — có hồ sơ thì kèm diện tích / giá theo cài đặt link. */
function shareZaloMessage(link: PostingShareLink, posting?: AssetPosting | null): string {
  return buildZaloMessage({
    title: posting?.title ?? link.targetTitle,
    area: posting ? areaOf(posting) : null,
    startingPrice: posting && link.showPrice ? posting.starting_price : null,
    province: posting?.province ?? null,
    url: sharedPostingUrl(link.code ?? ""),
  });
}

/** Người quản lý được link: RPC tổng hợp / chi tiết trả can_manage; danh sách theo hồ sơ dùng canShare chung. */
const canManageOf = (link: PostingShareLink, canShare: boolean) => link.canManage ?? canShare;

interface RowProps {
  link: PostingShareLink;
  posting?: AssetPosting | null;
  canShare: boolean;
  onEdit?: (link: PostingShareLink) => void;
  onRevoke: (link: PostingShareLink) => void;
}

function RowActions({ link, posting, canShare, onEdit, onRevoke }: RowProps) {
  const state = shareLinkState(link);
  if (!canManageOf(link, canShare) || !link.code) return null;
  const url = sharedPostingUrl(link.code);
  const copy = async (text: string, ok: string) =>
    (await copyText(text)) ? toast.success(ok) : toast.error("Trình duyệt chặn sao chép — hãy thử lại.");
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div onClick={stop}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Thao tác với link ${link.label}`}>
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {state === "active" && (
            <>
              <DropdownMenuItem onSelect={() => void copy(url, "Đã sao chép link")}>
                <Copy className="mr-2 h-4 w-4" strokeWidth={1.5} /> Sao chép link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copy(shareZaloMessage(link, posting), "Đã sao chép tin nhắn — dán vào Zalo")}>
                <MessageCircle className="mr-2 h-4 w-4" strokeWidth={1.5} /> Tin nhắn Zalo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void downloadShareQr(link)}>
                <QrCode className="mr-2 h-4 w-4" strokeWidth={1.5} /> Tải mã QR
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onSelect={() => window.open(url, "_blank", "noopener")}>
            <ExternalLink className="mr-2 h-4 w-4" strokeWidth={1.5} /> Xem như người nhận
          </DropdownMenuItem>
          {state !== "revoked" && (
            <>
              {onEdit && (
                <DropdownMenuItem onSelect={() => onEdit(link)}>
                  <Pencil className="mr-2 h-4 w-4" strokeWidth={1.5} /> Sửa
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onRevoke(link)}>
                <Undo2 className="mr-2 h-4 w-4" strokeWidth={1.5} /> Thu hồi
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function StateBadge({ link }: { link: PostingShareLink }) {
  const state = shareLinkState(link);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", STATE_TONE[state])}>
        {SHARE_LINK_STATE_LABEL[state]}
      </span>
      <span className="whitespace-nowrap text-xs text-muted-foreground">{shareLinkStateNote(link)}</span>
    </span>
  );
}

/** Kênh + nguồn (chiến dịch / tạo riêng) dưới tên link. */
function LinkMeta({ link }: { link: PostingShareLink }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
      <span className="shrink-0 rounded bg-muted px-1.5 py-px font-medium text-foreground/80">{channelLabel(link.channel)}</span>
      {link.campaignName ? (
        <span className="flex min-w-0 items-center gap-1 truncate">
          <Megaphone className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">{link.campaignName}</span>
        </span>
      ) : (
        <span className="truncate">{link.createdByName ?? "—"}</span>
      )}
    </p>
  );
}

function AssetCell({ link }: { link: PostingShareLink }) {
  const Icon = link.targetKind === "posting" ? FileText : Store;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-foreground">{link.targetTitle}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[link.targetKind === "posting" ? "Hồ sơ số hoá" : "Tin trên sàn", link.targetCode, link.branchName]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}

interface ShareLinksTableProps {
  links: PostingShareLink[];
  /** Có ⇒ danh sách của MỘT hồ sơ (ẩn cột tài sản, tin nhắn Zalo kèm thông số). */
  posting?: AssetPosting | null;
  /** Quyền chung khi RPC không trả can_manage từng dòng. */
  canShare: boolean;
  showAsset?: boolean;
  onEdit?: (link: PostingShareLink) => void;
}

/**
 * Bảng link Hồ sơ online + số liệu trọn đời (chỉ số đếm — không bao giờ biết ai xem). Bấm dòng
 * ⇒ trang chi tiết link (biểu đồ theo ngày). Điện thoại: thẻ.
 */
export function ShareLinksTable({ links, posting, canShare, showAsset = false, onEdit }: ShareLinksTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [revoking, setRevoking] = useState<PostingShareLink | null>(null);
  const revoke = useRevokeShareLink();
  const rowProps = { posting, canShare, onEdit, onRevoke: setRevoking };
  const open = (l: PostingShareLink) => navigate(shareLinkHref(l.id, `${location.pathname}${location.search}`));

  return (
    <>
      {/* ≥ md: bảng */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Link</th>
              {showAsset && <th className="py-2 pr-3 font-medium">Tài sản</th>}
              <th className="py-2 pr-3 font-medium">Trạng thái</th>
              <th className="py-2 pr-3 text-right font-medium">Lượt xem</th>
              <th className="py-2 pr-3 text-right font-medium">Mua hồ sơ</th>
              <th className="py-2 pr-3 text-right font-medium">Theo dõi</th>
              <th className="py-2 pr-3 font-medium">Xem lần cuối</th>
              <th className="py-2" aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr
                key={l.id}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/30"
                onClick={() => open(l)}
              >
                <td className="max-w-[240px] py-2.5 pr-3">
                  <button
                    type="button"
                    className="block max-w-full truncate text-left font-medium text-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      open(l);
                    }}
                  >
                    {l.label}
                  </button>
                  <LinkMeta link={l} />
                </td>
                {showAsset && (
                  <td className="max-w-[260px] py-2.5 pr-3">
                    <AssetCell link={l} />
                  </td>
                )}
                <td className="py-2.5 pr-3">
                  <StateBadge link={l} />
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  <span className="font-semibold">{n(l.viewCount)}</span>
                  <span className="block text-xs text-muted-foreground">{n(l.uniqueViewCount)} người</span>
                </td>
                <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{n(l.ctaDossierCount)}</td>
                <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{n(l.ctaFollowCount)}</td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-muted-foreground">{formatShareDayTime(l.lastViewedAt)}</td>
                <td className="py-2.5 text-right">
                  <RowActions link={l} {...rowProps} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < md: thẻ */}
      <ul className="space-y-2 md:hidden">
        {links.map((l) => (
          <li key={l.id} className="rounded-xl border border-border p-3" onClick={() => open(l)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{l.label}</p>
                <LinkMeta link={l} />
                {showAsset && <p className="mt-1 truncate text-xs text-muted-foreground">{l.targetTitle}</p>}
              </div>
              <RowActions link={l} {...rowProps} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <StateBadge link={l} />
              <span className="tabular-nums">
                <b className="text-foreground">{n(l.viewCount)}</b> xem · {n(l.uniqueViewCount)} người
              </span>
              <span className="tabular-nums">
                <b className="text-foreground">{n(l.ctaDossierCount)}</b> mua hồ sơ
              </span>
              <span className="tabular-nums">
                <b className="text-foreground">{n(l.ctaFollowCount)}</b> theo dõi
              </span>
            </div>
          </li>
        ))}
      </ul>

      <RevokeShareLinkDialog
        link={revoking}
        pending={revoke.isPending}
        onClose={() => setRevoking(null)}
        onConfirm={(l) => revoke.mutate(l.id, { onSuccess: () => setRevoking(null) })}
      />
    </>
  );
}
