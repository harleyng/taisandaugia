import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, CalendarDays, ExternalLink, Gavel, Globe, MapPin, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SessionStatePill } from "./list/SessionStatePill";
import { CancelSessionDialog } from "./CancelSessionDialog";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { PublishSessionDialog } from "./PublishSessionDialog";
import { heroRange } from "@/lib/auctionSessions/sessionDetail";
import { sessionRowState } from "@/lib/auctionSessions/sessionList";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { AuctionSessionWithItems } from "@/types/auction-session";

type DialogKind = "publish" | "cancel" | "delete" | null;

/** Nút của design (`.btn`): cao 36px, chữ 13px đậm. */
export const DESIGN_BTN = "h-9 gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold";

interface Props {
  session: AuctionSessionWithItems;
  isApproved: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}

/**
 * Thẻ đầu trang chi tiết phiên (design `.hd`): mã + trạng thái, tên, dòng meta và
 * hàng thao tác vòng đời (sửa / xem trên sàn / công bố / huỷ / xoá nháp).
 *
 * Thao tác sống ở ĐÂY chứ không ở trang: cả ba đều mở dialog riêng, để trạng
 * thái dialog trong trang thì trang phải gánh thêm một máy trạng thái chỉ để
 * phục vụ mấy cái nút của hero.
 */
export function SessionDetailHero({ session, isApproved, canUpdate, canDelete, onEdit, onDeleted }: Props) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const closeDialog = (open: boolean) => !open && setDialog(null);

  const state = sessionRowState(session);
  const online = session.auction_format === "truc_tuyen";
  const place = online
    ? session.province || "Chưa chọn tỉnh"
    : session.venue || session.province || "Chưa có địa điểm";
  // Design: chỉ sửa được trước giờ đấu; phiên huỷ thì server cũng chặn.
  const editable = state === "draft" || state === "reg" || state === "upcoming";
  const publishReady =
    session.auction_session_items.length > 0 && Date.parse(session.starts_at) > Date.now();
  const menu =
    state === "draft" && canDelete
      ? { label: "Xoá nháp", icon: Trash2, kind: "delete" as const }
      : (state === "reg" || state === "upcoming") && canUpdate
        ? { label: "Huỷ phiên", icon: Ban, kind: "cancel" as const }
        : null;

  return (
    <>
      <section className="grid gap-5 rounded-2xl bg-card px-6 py-[22px] shadow-card md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span className="rounded-[5px] bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{session.code}</span>
            <SessionStatePill state={state} />
          </div>
          <h1 className="mt-1 text-[23px] font-bold tracking-[-0.015em] text-foreground [text-wrap:pretty]">
            {session.title}
          </h1>
          <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarDays className="h-[15px] w-[15px] shrink-0" />
              {heroRange(session.starts_at, session.ends_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {online ? <Globe className="h-[15px] w-[15px] shrink-0" /> : <Gavel className="h-[15px] w-[15px] shrink-0" />}
              {AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-[15px] w-[15px] shrink-0" />
              {place}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {canUpdate && editable && (
            <Button variant="outline" className={DESIGN_BTN} onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Chỉnh sửa
            </Button>
          )}
          {session.status !== "draft" && (
            <Button variant="outline" className={DESIGN_BTN} onClick={() => navigate(`/sessions/${session.id}`)}>
              <ExternalLink className="h-4 w-4" />
              Xem trên sàn
            </Button>
          )}
          {session.status === "draft" && canUpdate && (
            <Button
              className={DESIGN_BTN}
              onClick={() => setDialog("publish")}
              disabled={!publishReady}
              title={publishReady ? undefined : "Chưa đủ điều kiện công bố"}
            >
              <Send className="h-4 w-4" />
              Công bố
            </Button>
          )}
          {menu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" aria-label="Thêm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[170px]">
                <DropdownMenuItem
                  className="gap-2 text-[13px] font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={() => setDialog(menu.kind)}
                >
                  <menu.icon className="h-4 w-4" />
                  {menu.label}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </section>

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
