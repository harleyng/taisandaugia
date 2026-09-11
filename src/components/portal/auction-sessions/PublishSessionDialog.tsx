import { CheckCircle2, Circle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePublishAuctionSession } from "@/hooks/useAuctionSessions";
import type { AuctionSessionWithItems } from "@/types/auction-session";

interface Props {
  session: AuctionSessionWithItems;
  isApproved: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Checklist BÁO TRƯỚC điều kiện công bố. Cổng thật là trigger
 * auction_sessions_guard — thiếu điều kiện nào server vẫn từ chối kèm lý do.
 */
export function PublishSessionDialog({ session, isApproved, open, onOpenChange }: Props) {
  const publish = usePublishAuctionSession();
  const checks = [
    { ok: session.auction_session_items.length > 0, label: "Có ít nhất 1 tài sản trong phiên" },
    { ok: Date.parse(session.starts_at) > Date.now(), label: "Thời gian đấu giá ở tương lai" },
    { ok: isApproved && !!session.auction_org_id, label: "Tổ chức đã được duyệt KYC và liên kết danh bạ" },
  ];
  const ready = checks.every((c) => c.ok);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Công bố phiên lên sàn?</DialogTitle>
          <DialogDescription>
            Phiên sẽ hiện ngay ở trang Phiên đấu giá và trang tổ chức. Phiên đã công bố không xoá được — chỉ huỷ kèm lý do.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-1">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publish.isPending}>
            Để sau
          </Button>
          <Button
            onClick={() => publish.mutate(session.id, { onSuccess: () => onOpenChange(false) })}
            disabled={!ready || publish.isPending}
            className="gap-1.5"
          >
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Công bố
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
