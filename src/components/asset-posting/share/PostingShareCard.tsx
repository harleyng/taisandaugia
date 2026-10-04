import { useState } from "react";
import { Globe, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { usePostingShareLinks } from "@/hooks/usePostingShareLinks";
import { shareLinkState } from "@/lib/postingShare/status";
import type { PostingShareLink } from "@/lib/postingShare/types";
import type { AssetPosting } from "@/types/asset-posting";
import { ShareLinkDialog } from "./ShareLinkDialog";
import { ShareLinksTable } from "./ShareLinksTable";

/** Lý do chưa tạo được link (D3) — null = tạo được. */
function blockedReason(p: AssetPosting): string | null {
  if (p.status === "cancelled") return "Hồ sơ đã huỷ — không chia sẻ được.";
  if (p.review_status !== "approved") return "Hồ sơ cần được sàn duyệt trước khi chia sẻ ra ngoài.";
  return null;
}

/**
 * "Hồ sơ online" — link công khai /hs/:code để cán bộ gửi khách của đơn vị qua Zalo, email,
 * RM. Gồm cả link do chiến dịch truyền thông tạo. Mọi thành viên xem được số liệu; tạo / sửa /
 * thu hồi cần so-hoa:share hoặc truyen-thong:create — quyền thật do server trả (can_share).
 */
export function PostingShareCard({ posting }: { posting: AssetPosting }) {
  const { data, isLoading, isError } = usePostingShareLinks(posting.id);
  const [dialog, setDialog] = useState<{ link: PostingShareLink | null } | null>(null);
  const canShare = data?.canShare ?? false;
  const blocked = blockedReason(posting);
  const links = data?.links ?? [];
  const active = links.filter((l) => shareLinkState(l) === "active").length;

  const createButton = canShare && (
    <Button size="sm" className="gap-1.5" disabled={!!blocked} onClick={() => setDialog({ link: null })}>
      <Plus className="h-4 w-4" strokeWidth={1.5} />
      Tạo link chia sẻ
    </Button>
  );

  return (
    <SectionCard title="Hồ sơ online" icon={Globe} count={active} actions={links.length > 0 ? createButton : undefined}>
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : isError ? (
        <p className="text-sm text-destructive">Chưa tải được danh sách link. Tải lại trang để thử lại.</p>
      ) : links.length === 0 ? (
        <EmptyState
          compact
          icon={Link2}
          tone="muted"
          title="Chưa có link chia sẻ."
          description={
            blocked ??
            "Gửi khách một trang hồ sơ đẹp trên điện thoại: ảnh, thông số, pháp lý, lịch phiên. Khách không cần tài khoản; đơn vị chỉ thấy số lượt xem, không thấy ai xem."
          }
          action={createButton || undefined}
        />
      ) : (
        <div className="space-y-3">
          {blocked && canShare && <p className="text-xs text-muted-foreground">{blocked} Link đang mở tạm thời không xem được.</p>}
          <ShareLinksTable
            links={links}
            posting={posting}
            canShare={canShare}
            onEdit={(link) => setDialog({ link })}
          />
        </div>
      )}

      {canShare && (
        <ShareLinkDialog
          target={{ kind: "posting", postingId: posting.id, workspaceId: posting.workspace_id }}
          open={!!dialog}
          link={dialog?.link ?? null}
          onClose={() => setDialog(null)}
        />
      )}
    </SectionCard>
  );
}
