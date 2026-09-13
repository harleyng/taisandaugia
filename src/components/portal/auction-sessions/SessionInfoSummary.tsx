import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTimeRange } from "@/lib/auctionSessions/datetime";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { AuctionSession } from "@/types/auction-session";

/**
 * Bản CHỈ ĐỌC của thông tin phiên — mặc định của tab "Thông tin".
 *
 * Vì sao không dùng luôn SessionFormCard ở chế độ readOnly: trang này chủ yếu
 * để ĐỌC (xem lịch, đối chiếu giá hồ sơ), mà một form với chục ô input xám là
 * cách trình bày tệ cho việc đọc. Bấm "Chỉnh sửa" mới đổi sang form thật.
 *
 * Gộp luôn quy tắc trả giá dù bên sửa là hai thẻ riêng (SessionFormCard +
 * SessionBiddingRulesCard): người đọc không quan tâm hai nhóm cột bị trigger
 * khoá khác nhau — đó là chuyện của lúc sửa.
 */

const ONLINE_FORMATS = new Set(["truc_tuyen", "ca_hai"]);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{children ?? "—"}</dd>
    </div>
  );
}

export function SessionInfoSummary({ session }: { session: AuctionSession }) {
  const online = ONLINE_FORMATS.has(session.auction_format);

  const schedule: { label: string; value: string | null }[] = [
    { label: "Bán & nhận hồ sơ", value: formatDateTimeRange(session.registration_start_at, session.registration_end_at) },
    { label: "Xem tài sản", value: formatDateTimeRange(session.viewing_start_at, session.viewing_end_at) },
    { label: "Thời gian đấu giá", value: formatDateTimeRange(session.starts_at, session.ends_at) },
  ];

  return (
    <Card className="space-y-5 rounded-2xl p-5">
      <div>
        <h2 className="font-semibold text-foreground">Thông tin phiên</h2>
        <p className="text-xs text-muted-foreground">Người mua thấy toàn bộ thông tin này khi phiên được công bố.</p>
      </div>

      {session.description && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{session.description}</p>
      )}

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Hình thức">{AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format}</Field>
        <Field label="Tỉnh / thành">{session.province || "—"}</Field>
        <Field label="Địa điểm tổ chức">{session.venue || "—"}</Field>
        <Field label="Số người đăng ký tối đa">
          {session.max_registrants != null ? `${session.max_registrants} người` : "Không giới hạn"}
        </Field>
        <Field label="Giá bán hồ sơ">
          {session.dossier_fee != null ? formatVnd(session.dossier_fee) : "Không bán qua sàn"}
        </Field>
      </dl>

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Lịch phiên</h3>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schedule.map((row) => (
            <Field key={row.label} label={row.label}>
              {row.value ?? "Chưa khai báo"}
            </Field>
          ))}
        </dl>
      </div>

      {online && (
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Quy tắc trả giá trực tuyến</h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Hình thức trả giá">Trả giá lên</Field>
            <Field label="Thời gian gia hạn">
              {session.extension_seconds > 0 ? `${session.extension_seconds} giây` : "Không gia hạn"}
            </Field>
            <Field label="Số bước giá tối đa mỗi lượt">{session.max_bid_steps} bước</Field>
          </dl>
        </div>
      )}
    </Card>
  );
}
