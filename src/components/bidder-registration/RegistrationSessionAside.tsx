import { FileSignature } from "lucide-react";
import { InfoCardShell } from "@/components/shared/InfoCardShell";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import type { PublicSessionDetail } from "@/types/auction-session";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";

/** Cột phải trang đăng ký: phiên đang đăng ký + những gì xảy ra sau khi thanh toán. */
export function RegistrationSessionAside({ session }: { session: PublicSessionDetail }) {
  const rows: [string, string][] = [
    ["Mã phiên", session.code],
    ["Tổ chức đấu giá", session.auction_organizations?.name ?? "—"],
    ["Hình thức", AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format],
    ["Bắt đầu", formatDateTime(session.starts_at)],
    ...(session.registration_end_at ? ([["Hạn mua hồ sơ", formatDateTime(session.registration_end_at)]] as [string, string][]) : []),
  ];

  return (
    <InfoCardShell title="Phiên đăng ký" icon={<FileSignature className="h-5 w-5 text-foreground" />} bodyClassName="space-y-4">
      <p className="font-semibold text-foreground">{session.title}</p>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between gap-2 border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">Giá hồ sơ</span>
        <span className="text-xl font-bold text-primary">{formatVnd(session.dossier_fee ?? 0)}</span>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Thanh toán tiền hồ sơ qua VNPay.</li>
        <li>Tổ chức đấu giá duyệt hồ sơ (có thể yêu cầu bổ sung).</li>
        <li>Nộp tiền đặt trước theo hướng dẫn của tổ chức.</li>
        <li>Điểm danh trước giờ đấu giá để nhận số báo danh.</li>
      </ol>
    </InfoCardShell>
  );
}
