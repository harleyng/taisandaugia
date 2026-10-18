import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Info, Lock, Printer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignBidderNoDialog } from "@/components/portal/bidding-contracts/AssignBidderNoDialog";
import { CheckInConfirmDialog } from "@/components/portal/checkin/CheckInConfirmDialog";
import { CheckinBoardTable } from "@/components/portal/checkin/CheckinBoardTable";
import { CheckinLookupPanel } from "@/components/portal/checkin/CheckinLookupPanel";
import { CheckinWindowNote } from "@/components/portal/checkin/CheckinWindowNote";
import { CloseRosterDialog } from "@/components/portal/checkin/CloseRosterDialog";
import { ExcuseAbsenceDialog } from "@/components/portal/checkin/ExcuseAbsenceDialog";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { useServerNow } from "@/hooks/useServerClock";
import { useSessionCheckin } from "@/hooks/useSessionCheckin";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { boardBannerOf, boardWindowOf } from "@/lib/biddingContracts/checkinBoard";
import { contractToLookupMatch } from "@/lib/biddingContracts/checkinRoster";
import { checkinChannelOf } from "@/lib/biddingContracts/checkinWindow";
import { bidderCardPrintPath, sessionContractPath, sessionRosterPrintPath } from "@/lib/biddingContracts/paths";
import { closeRosterBlockOf, rosterAlertOf } from "@/lib/biddingContracts/rosterSummary";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { CheckinLookupMatch, ContractWithSession } from "@/types/bidding-contract";
import { DetailNote, TabHeader } from "../DetailCard";
import { DESIGN_BTN } from "../SessionDetailHero";

interface Props {
  session: AuctionSessionWithItems;
}

const TITLE = "Điểm danh";

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-card">
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-muted">
        <Users className="h-[18px] w-[18px]" />
      </span>
      <b className="mb-1 block text-[15px] text-foreground">{title}</b>
      {body}
    </section>
  );
}

/**
 * Tab "Điểm danh" (/portal/phien-dau-gia/:id/diem-danh — design `checkinTab`). Phiên trực
 * tiếp: bàn điểm danh tại cửa (quét phiếu / tìm) + danh sách. Phiên trực tuyến: người mua
 * tự điểm danh ⇒ tổ chức chỉ theo dõi. Quyền xét theo tổ chức CỦA PHIÊN.
 *
 * Phiên "Cả hai" (tạm bỏ): server không điểm danh ⇒ chỉ còn dải giải thích + danh sách để xem.
 *
 * Ngoài design (giữ từ S6): nút "Chốt danh sách ngay" + cảnh báo dưới 2 người có mặt.
 */
export function SessionCheckinTab({ session }: Props) {
  const canCheckInPerm = useHasOrgPermissionIn(session.organization_id, "ho-so-tham-gia", "checkin");
  // Cùng quyền mà org_close_roster_now / org_excuse_absence / org_assign_bidder_no hỏi ở server.
  const canCloseRoster = useHasOrgPermissionIn(session.organization_id, "dieu-hanh-dau-gia", "operate");
  const canUpdate = useHasOrgPermissionIn(session.organization_id, "ho-so-tham-gia", "update");
  const now = useServerNow(15_000);
  const { roster, summary } = useSessionCheckin(session.status === "draft" ? null : session.id);
  const [selected, setSelected] = useState<CheckinLookupMatch | null>(null);
  const [excusing, setExcusing] = useState<ContractWithSession | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const onSelect = useCallback((m: CheckinLookupMatch) => setSelected(m), []);

  const channel = checkinChannelOf(session.auction_format);

  if (session.status === "draft") {
    return <EmptyCard title="Chưa có người tham gia" body="Phiên chưa công bố nên chưa có ai để điểm danh." />;
  }
  const onsite = channel === "onsite";
  // summary tự làm mới 10 giây ⇒ biết cron đã chốt danh sách trước khi session tải lại.
  const s = { ...session, roster_closed_at: summary.data?.roster_closed_at ?? session.roster_closed_at };
  const win = boardWindowOf(s, now);
  const canCheckIn = onsite && win === "open" && canCheckInPerm;
  const contracts = roster.data ?? [];
  // Lấy lại theo id từ danh sách đang tự làm mới ⇒ sheet / hộp thoại thấy số liệu mới nhất.
  const assigning = contracts.find((c) => c.id === assigningId) ?? null;

  const block = closeRosterBlockOf(s, now);
  const showClose = canCloseRoster && win === "open" && (block === null || block === "too_early");
  const alert = summary.data && win !== "cancelled" && win !== "unsupported" ? rosterAlertOf(summary.data, s, now) : null;
  const openPrint = (path: string) => window.open(`${path}?auto=1`, "_blank");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TabHeader
        title={TITLE}
        description={
          !channel
            ? "Xác nhận người đủ điều kiện có mặt trước giờ đấu giá."
            : onsite
              ? "Điểm danh tại cửa hội trường: quét phiếu hoặc tìm người tham gia rồi xác nhận có mặt."
              : "Người tham gia tự điểm danh bằng mã xác nhận gửi tới số điện thoại đăng ký. Màn này để theo dõi."
        }
        actions={
          (win === "open" || win === "closed" || showClose) && (
            <>
              {showClose && (
                <Button
                  variant="outline"
                  className={`${DESIGN_BTN} text-destructive hover:bg-destructive/5 hover:text-destructive`}
                  disabled={block === "too_early"}
                  title={block === "too_early" ? `Chốt sớm được từ ${formatDateTime(session.starts_at)}` : undefined}
                  onClick={() => setClosing(true)}
                >
                  <Lock className="h-4 w-4" />
                  Chốt danh sách ngay
                </Button>
              )}
              <Button variant="outline" className={DESIGN_BTN} onClick={() => openPrint(sessionRosterPrintPath(session.id))}>
                <Printer className="h-4 w-4" />
                In danh sách
              </Button>
            </>
          )
        }
      />

      <CheckinWindowNote banner={boardBannerOf(win, s)} />

      {alert && (
        <DetailNote icon={<AlertTriangle />}>
          <b className="font-semibold">{alert.title}.</b> {alert.body}
        </DetailNote>
      )}

      {onsite && win === "open" && !canCheckInPerm && (
        <DetailNote tone="muted" icon={<Info />}>
          Vai trò của bạn chưa được cấp quyền “Điểm danh” cho hồ sơ tham gia — chỉ xem danh sách.
        </DetailNote>
      )}

      {canCheckIn && <CheckinLookupPanel sessionId={session.id} onSelect={onSelect} />}

      <CheckinBoardTable
        session={s}
        contracts={contracts}
        isLoading={roster.isLoading}
        now={now}
        window={win}
        canCheckIn={canCheckIn}
        onCheckIn={(c, state) => onSelect(contractToLookupMatch(c, state))}
        onOpenContract={(c) => navigate(sessionContractPath(session.id, c.code))}
        canUpdate={canUpdate}
        onAssign={(c) => setAssigningId(c.id)}
        onExcuse={setExcusing}
        onPrintCard={(c) => openPrint(bidderCardPrintPath(session.id, c.id))}
      />

      <CheckInConfirmDialog match={selected} onOpenChange={(open) => !open && setSelected(null)} />
      <ExcuseAbsenceDialog contract={excusing} onOpenChange={(open) => !open && setExcusing(null)} />
      <AssignBidderNoDialog contract={assigning} onOpenChange={(open) => !open && setAssigningId(null)} />
      {showClose && summary.data && (
        <CloseRosterDialog
          open={closing}
          onOpenChange={setClosing}
          sessionId={session.id}
          awaiting={summary.data.awaiting}
        />
      )}
    </div>
  );
}
