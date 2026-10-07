import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { InfoBox } from "@/components/shared/InfoBox";
import { CheckInConfirmDialog } from "@/components/portal/checkin/CheckInConfirmDialog";
import { CheckinLookupPanel } from "@/components/portal/checkin/CheckinLookupPanel";
import { CheckinRosterTable } from "@/components/portal/checkin/CheckinRosterTable";
import { CheckinWindowBanner } from "@/components/portal/checkin/CheckinWindowBanner";
import { ExcuseAbsenceDialog } from "@/components/portal/checkin/ExcuseAbsenceDialog";
import { RosterSummaryCard } from "@/components/portal/checkin/RosterSummaryCard";
import { useHasOrgPermissionIn } from "@/hooks/useOrgPermissions";
import { useSessionCheckin } from "@/hooks/useSessionCheckin";
import { checkinChannelOf } from "@/lib/biddingContracts/checkinWindow";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { CheckinLookupMatch, ContractWithSession } from "@/types/bidding-contract";

interface Props {
  session: AuctionSessionWithItems;
}

/**
 * Tab "Điểm danh" (/portal/phien-dau-gia/:id/diem-danh). Phiên trực tiếp: bàn
 * điểm danh tại cửa (quét phiếu / tìm) + danh sách. Phiên trực tuyến: người mua
 * tự điểm danh ⇒ tổ chức chỉ xem danh sách. Quyền xét theo tổ chức CỦA PHIÊN.
 */
export function SessionCheckinTab({ session }: Props) {
  const canCheckInPerm = useHasOrgPermissionIn(session.organization_id, "ho-so-tham-gia", "checkin");
  // Cùng quyền mà org_close_roster_now / org_excuse_absence hỏi ở server.
  const canCloseRoster = useHasOrgPermissionIn(session.organization_id, "dieu-hanh-dau-gia", "operate");
  const canExcuse = useHasOrgPermissionIn(session.organization_id, "ho-so-tham-gia", "update");
  const { roster, summary } = useSessionCheckin(session.status === "draft" ? null : session.id);
  const [selected, setSelected] = useState<CheckinLookupMatch | null>(null);
  const [excusing, setExcusing] = useState<ContractWithSession | null>(null);
  const onSelect = useCallback((m: CheckinLookupMatch) => setSelected(m), []);

  const channel = checkinChannelOf(session.auction_format);

  if (session.status === "draft") {
    return (
      <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
        Phiên chưa công bố nên chưa có người tham gia để điểm danh.
      </Card>
    );
  }
  if (!channel) {
    return (
      <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
        Phiên theo hình thức “Cả hai” chưa hỗ trợ điểm danh trên hệ thống.
      </Card>
    );
  }

  const onsite = channel === "onsite";
  // summary tự làm mới ⇒ biết cron đã chốt danh sách trước khi session tải lại.
  const live = session.status === "published" && !(summary.data?.roster_closed_at ?? session.roster_closed_at);
  const canCheckIn = onsite && live && canCheckInPerm;

  return (
    <div className="space-y-5">
      <CheckinWindowBanner session={session} summary={summary.data} />
      <RosterSummaryCard session={session} summary={summary.data} canClose={canCloseRoster} />

      {session.status === "cancelled" && (
        <InfoBox variant="amber" className="text-sm">
          Phiên đã huỷ — không điểm danh.
        </InfoBox>
      )}
      {!onsite && (
        <InfoBox variant="primary" className="text-sm">
          Phiên trực tuyến: người tham gia tự điểm danh trên sàn bằng mã xác nhận gửi tới số điện thoại đăng ký. Màn
          này chỉ để theo dõi.
        </InfoBox>
      )}
      {onsite && live && !canCheckInPerm && (
        <InfoBox variant="amber" className="text-sm">
          Vai trò của bạn chưa được cấp quyền “Điểm danh” cho hồ sơ tham gia — chỉ xem danh sách.
        </InfoBox>
      )}

      {canCheckIn && <CheckinLookupPanel sessionId={session.id} onSelect={onSelect} />}

      <CheckinRosterTable
        session={session}
        contracts={roster.data ?? []}
        isLoading={roster.isLoading}
        canCheckIn={canCheckIn}
        onSelect={onSelect}
        canExcuse={canExcuse}
        onExcuse={setExcusing}
      />

      <CheckInConfirmDialog match={selected} onOpenChange={(open) => !open && setSelected(null)} />
      <ExcuseAbsenceDialog contract={excusing} onOpenChange={(open) => !open && setExcusing(null)} />
    </div>
  );
}
