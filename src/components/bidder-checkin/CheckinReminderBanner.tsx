import { useNavigate } from "react-router-dom";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/shared/InfoBox";
import { useServerNow } from "@/hooks/useServerClock";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { checkinReminderOf, formatDurationVi } from "@/lib/biddingContracts/checkinReminder";
import type { AttendanceContract, AttendanceSession } from "@/lib/biddingContracts/eligibility";

/**
 * Nhắc điểm danh trong app (D2) — phiên còn ≤ 24 giờ mà chưa điểm danh.
 * Không có bảng thông báo / email: chỉ hiện khi người mua mở trang phiên hoặc
 * hồ sơ của tôi. Tự ẩn khi không còn gì để nhắc.
 */

interface Props {
  contract: AttendanceContract;
  session: AttendanceSession & { id: string; title?: string; venue?: string | null };
  /** Ở trang hồ sơ: thêm tên phiên + nút sang trang phiên. */
  showSession?: boolean;
}

const TICK_MS = 30_000;

export function CheckinReminderBanner({ contract, session, showSession }: Props) {
  const navigate = useNavigate();
  const now = useServerNow(TICK_MS);
  const r = checkinReminderOf(contract, session, now);
  if (!r) return null;

  const at = (d: Date) => formatDateTime(d.toISOString());
  const venue = session.venue ? ` tại ${session.venue}` : " tại địa điểm tổ chức";

  const title =
    r.phase === "open"
      ? `Đang mở điểm danh — đóng lúc ${at(r.closesAt)}`
      : `Phiên bắt đầu sau ${formatDurationVi(r.startsAt.getTime() - now.getTime())} — điểm danh mở lúc ${at(r.opensAt)}`;

  const detail =
    r.channel === "online"
      ? "Tự điểm danh trên trang phiên bằng mã xác nhận gửi qua tin nhắn để nhận số báo danh."
      : `Điểm danh${venue}: mang phiếu dự phiên và giấy tờ tuỳ thân bản gốc.`;

  return (
    <InfoBox variant={r.phase === "open" ? "amber" : "primary"} className="flex items-start gap-3">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {showSession && session.title && <p className="truncate text-xs font-medium">{session.title}</p>}
        <p className="font-semibold">{title}</p>
        <p className="text-sm">
          {detail} Chưa điểm danh khi đóng sẽ bị ghi vắng mặt và mất tiền đặt trước.
        </p>
      </div>
      {showSession && (
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate(`/sessions/${session.id}`)}>
          {r.phase === "open" && r.channel === "online" ? "Điểm danh" : "Xem phiên"}
        </Button>
      )}
    </InfoBox>
  );
}
