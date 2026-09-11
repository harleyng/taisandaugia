import type { ReactNode } from "react";
import { CalendarClock, Eye, FileText, Gavel, Layers, MapPin, Receipt, Users } from "lucide-react";
import { InfoCardShell } from "@/components/shared/InfoCardShell";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTimeRange } from "@/lib/auctionSessions/datetime";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { PublicSession } from "@/types/auction-session";

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border py-2.5 last:border-0">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Lịch mốc + hình thức + giới hạn của phiên — cột phải trang chi tiết. */
export function SessionTimeline({ session }: { session: PublicSession }) {
  const registration = formatDateTimeRange(session.registration_start_at, session.registration_end_at);
  const viewing = formatDateTimeRange(session.viewing_start_at, session.viewing_end_at);
  const place = [session.venue, session.province].filter(Boolean).join(", ");
  const iconClass = "h-4 w-4";

  return (
    <InfoCardShell title="Thông tin phiên" icon={<CalendarClock className="h-5 w-5 text-foreground" />} bodyClassName="py-2">
      {registration && <Row icon={<FileText className={iconClass} />} label="Bán & nhận hồ sơ" value={registration} />}
      {session.dossier_fee != null && session.dossier_fee > 0 && (
        <Row icon={<Receipt className={iconClass} />} label="Giá bán hồ sơ" value={formatVnd(session.dossier_fee)} />
      )}
      {viewing && <Row icon={<Eye className={iconClass} />} label="Xem tài sản" value={viewing} />}
      <Row
        icon={<Gavel className={iconClass} />}
        label="Thời gian đấu giá"
        value={formatDateTimeRange(session.starts_at, session.ends_at)}
      />
      <Row
        icon={<Layers className={iconClass} />}
        label="Hình thức"
        value={AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format}
      />
      {place && <Row icon={<MapPin className={iconClass} />} label="Địa điểm" value={place} />}
      <Row
        icon={<Users className={iconClass} />}
        label="Số người đăng ký tối đa"
        value={session.max_registrants != null ? `${session.max_registrants} người` : "Tổ chức chưa đặt giới hạn"}
      />
    </InfoCardShell>
  );
}
