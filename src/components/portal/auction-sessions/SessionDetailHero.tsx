import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, CalendarClock, ExternalLink, Layers, MapPin, Pencil, Send, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DetailHero } from "@/components/shared/DetailHero";
import { SessionStateBadge } from "@/components/auction-sessions/SessionStateBadge";
import { CancelSessionDialog } from "./CancelSessionDialog";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { PublishSessionDialog } from "./PublishSessionDialog";
import { formatDateTimeRange } from "@/lib/auctionSessions/datetime";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { AuctionSessionWithItems } from "@/types/auction-session";

type DialogKind = "publish" | "cancel" | "delete" | null;

interface Props {
  session: AuctionSessionWithItems;
  isApproved: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  /** Đang ở chế độ sửa ⇒ giấu nút "Chỉnh sửa" (tab Thông tin đã có Lưu / Huỷ). */
  editing: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}

/**
 * Hero tóm tắt phiên + hàng thao tác vòng đời (công bố / huỷ / xoá nháp).
 *
 * Thao tác sống ở ĐÂY chứ không ở trang: cả ba đều mở dialog riêng, để trạng
 * thái dialog trong trang thì trang phải gánh thêm một máy trạng thái chỉ để
 * phục vụ ba cái nút của hero.
 */
export function SessionDetailHero({ session, isApproved, canUpdate, canDelete, editing, onEdit, onDeleted }: Props) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const closeDialog = (open: boolean) => !open && setDialog(null);

  const status = session.status;
  const schedule = formatDateTimeRange(session.starts_at, session.ends_at);
  const place = session.province || session.venue;

  // Phải là undefined khi không có mục nào: DetailHero chỉ kiểm `overflow &&`,
  // mà một <></> rỗng vẫn truthy ⇒ hiện nút "…" mở ra menu trống.
  const overflow =
    status === "published" && canUpdate ? (
      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDialog("cancel")}>
        <Ban className="mr-2 h-4 w-4" />
        Huỷ phiên
      </DropdownMenuItem>
    ) : status === "draft" && canDelete ? (
      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDialog("delete")}>
        <Trash2 className="mr-2 h-4 w-4" />
        Xoá nháp
      </DropdownMenuItem>
    ) : undefined;

  return (
    <>
      <DetailHero
        status={<SessionStateBadge session={session} />}
        badges={<Badge variant="outline">{AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format}</Badge>}
        name={session.title}
        code={session.code}
        subtitle={
          <>
            {schedule && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                {schedule}
              </span>
            )}
            {place && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {place}
              </span>
            )}
            {session.max_registrants != null && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 shrink-0" />
                Tối đa {session.max_registrants} người
              </span>
            )}
          </>
        }
        stats={[{ icon: Layers, label: "Lô tài sản", value: session.auction_session_items.length }]}
        actions={
          <>
            {/* Phiên đã huỷ không sửa được nữa — server cũng chặn. */}
            {canUpdate && status !== "cancelled" && !editing && (
              <Button variant="secondary" size="sm" onClick={onEdit}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Chỉnh sửa
              </Button>
            )}
            {status !== "draft" && (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/sessions/${session.id}`)}>
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Xem trên sàn
              </Button>
            )}
            {status === "draft" && canUpdate && (
              <Button size="sm" onClick={() => setDialog("publish")}>
                <Send className="mr-1.5 h-4 w-4" />
                Công bố
              </Button>
            )}
          </>
        }
        overflow={overflow}
      />

      <PublishSessionDialog
        session={session}
        isApproved={isApproved}
        open={dialog === "publish"}
        onOpenChange={closeDialog}
      />
      <CancelSessionDialog sessionId={session.id} open={dialog === "cancel"} onOpenChange={closeDialog} />
      <DeleteSessionDialog
        sessionId={session.id}
        title={session.title}
        open={dialog === "delete"}
        onOpenChange={closeDialog}
        onDeleted={onDeleted}
      />
    </>
  );
}
