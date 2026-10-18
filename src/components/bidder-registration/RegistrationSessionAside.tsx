import { KvBox } from "@/components/auction-sessions/detail/ui";
import { CheckList } from "@/components/buyer-contracts/ui";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import type { PublicSessionDetail } from "@/types/auction-session";
import type { ContractSummary } from "@/types/bidding-contract";

/** Cột phải trang mua hồ sơ: phiên đang đăng ký + những gì cần chuẩn bị. */
export function RegistrationSessionAside({ session, summary }: { session: PublicSessionDetail; summary: ContractSummary | null }) {
  const image = [...session.auction_session_items].sort((a, b) => a.lot_no - b.lot_no).find((l) => l.image_url)?.image_url;
  const max = session.max_registrants;
  const taken = summary ? summary.paid_count + summary.held_count : null;
  const slots =
    max != null && taken != null ? `${taken}/${max} · còn ${Math.max(0, max - taken)} suất` : taken != null ? `${taken} hồ sơ` : "—";

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <div className="flex gap-3">
          <div className="h-14 w-[72px] shrink-0 overflow-hidden rounded-lg bg-muted">
            {image && <img src={image} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0">
            {session.code && <span className="font-mono text-xs text-muted-foreground">{session.code}</span>}
            <div className="text-sm font-semibold leading-snug text-foreground">{session.title}</div>
          </div>
        </div>
        <KvBox
          rows={[
            { label: "Giá hồ sơ", value: <b>{formatVnd(session.dossier_fee ?? 0)}</b> },
            { label: "Hạn mua hồ sơ", value: formatDateTime(session.registration_end_at) },
            { label: "Đã đăng ký", value: slots },
            { label: "Đấu giá", value: formatDateTime(session.starts_at) },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Phí hồ sơ không hoàn lại, trừ khi phiên bị huỷ hoặc tổ chức từ chối hồ sơ.
        </p>
      </section>
      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <h3 className="text-[15px] font-semibold text-foreground">Cần chuẩn bị</h3>
        <CheckList
          items={[
            { children: "CCCD gắn chip hoặc hộ chiếu" },
            { children: "Giấy ĐKDN, nếu đứng tên tổ chức" },
            { children: "Giấy uỷ quyền công chứng, nếu nhờ người khác dự phiên" },
          ]}
        />
      </section>
    </>
  );
}
