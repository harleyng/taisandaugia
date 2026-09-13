import { InfoBox } from "@/components/shared/InfoBox";
import { OutreachWorkspace } from "@/components/portal/outreach/OutreachWorkspace";
import type { AuctionSessionWithItems } from "@/types/auction-session";

/** Tab "Tiếp thị phiên": gói tiếp thị + danh sách người nhận của một phiên. */
export function SessionOutreachTab({ session }: { session: AuctionSessionWithItems }) {
  return (
    <div className="space-y-5">
      {session.status === "cancelled" && (
        <InfoBox variant="amber" className="text-sm">
          Phiên đã huỷ — danh sách chỉ còn để tham khảo, không nên gửi thông tin tiếp thị nữa.
        </InfoBox>
      )}
      <OutreachWorkspace session={session} />
    </div>
  );
}
