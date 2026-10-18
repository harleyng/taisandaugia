import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { fmtDate, fmtTime } from "@/lib/auctionSessions/sessionDetail";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { AuctionSession } from "@/types/auction-session";
import { DetailCard } from "./DetailCard";

/**
 * Bản CHỈ ĐỌC của thông tin phiên — hai thẻ ô "Thông tin cơ bản" và "Hồ sơ & trả
 * giá" của tab Thông tin (design `.tiles`). Sửa là trang form riêng (/:id/sua).
 */

interface Tile {
  label: string;
  value: string;
  /** wide = mô tả (chữ thường, cả hàng) · row = giá trị đậm nhưng chiếm cả hàng. */
  kind?: "code" | "wide" | "row";
}

const BIDDING_METHOD_LABELS: Record<string, string> = { ascending: "Trả giá lên" };

function TileGrid({ tiles, cols = 3 }: { tiles: Tile[]; cols?: 3 | 4 }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-[18px] px-[22px] pb-[22px] pt-2 min-[560px]:grid-cols-2",
        cols === 4 ? "min-[900px]:grid-cols-3 min-[1100px]:grid-cols-4" : "min-[900px]:grid-cols-3",
      )}
    >
      {tiles.map((t) => (
        <div key={t.label} className={cn("min-w-0", (t.kind === "wide" || t.kind === "row") && "col-span-full")}>
          <dt className="mb-1 text-[12.5px] text-muted-foreground">{t.label}</dt>
          <dd
            className={cn(
              "text-[14.5px] font-semibold text-foreground [overflow-wrap:anywhere] [text-wrap:pretty]",
              t.kind === "code" && "font-mono text-sm font-medium text-primary",
              t.kind === "wide" && "whitespace-pre-line font-normal leading-[1.55]",
            )}
          >
            {t.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SessionInfoSummary({ session }: { session: AuctionSession }) {
  const online = session.auction_format === "truc_tuyen";
  const created = new Date(session.created_at);

  const basics: Tile[] = [
    { label: "Mã phiên", value: session.code ?? "—", kind: "code" },
    { label: "Hình thức", value: AUCTION_FORMAT_LABELS[session.auction_format] ?? session.auction_format },
    { label: "Tỉnh / thành", value: session.province || "—" },
    { label: "Ngày tạo", value: `${fmtTime(created)} ${fmtDate(created)}` },
    // Địa chỉ thường dài ⇒ một hàng riêng dưới lưới 4 cột.
    { label: online ? "Nơi điều hành" : "Địa điểm", value: session.venue || "—", kind: "row" },
  ];
  if (session.description) basics.push({ label: "Mô tả", value: session.description, kind: "wide" });

  const dossier: Tile[] = [
    { label: "Giá bán hồ sơ", value: session.dossier_fee != null ? formatVnd(session.dossier_fee) : "Không bán qua sàn" },
    {
      label: "Số người tối đa",
      value: session.max_registrants != null ? `${session.max_registrants} người` : "Không giới hạn",
    },
  ];
  if (online) {
    dossier.push(
      { label: "Phương thức trả giá", value: BIDDING_METHOD_LABELS[session.bidding_method] ?? session.bidding_method },
      { label: "Bước giá tối đa / lượt", value: `${session.max_bid_steps} bước` },
      { label: "Gia hạn", value: session.extension_seconds > 0 ? `${session.extension_seconds} giây` : "Không gia hạn" },
    );
  }

  return (
    <>
      <DetailCard title="Thông tin cơ bản">
        <TileGrid tiles={basics} cols={4} />
      </DetailCard>
      <DetailCard title={online ? "Hồ sơ & trả giá" : "Hồ sơ tham gia"}>
        <TileGrid tiles={dossier} />
      </DetailCard>
    </>
  );
}
