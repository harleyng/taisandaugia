import type { ReactNode } from "react";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { formatMoneyShort } from "@/utils/money";
import {
  auctionNeedsDeclared,
  commissionLabel,
  printDay,
  statusBand,
} from "@/lib/asset-posting/postingPrint";
import { postingCompletionPct } from "@/components/asset-posting/wizardSchema";
import {
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  type AuctionFormat,
  type ExpectedTimeline,
} from "@/types/asset-posting";
import type { PostingPrintData } from "@/hooks/usePostingPrintData";
import { PrintEmpty, Slot } from "./printParts";

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.name]));
const CHILD_NAME: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

const One = ({ children, className }: { children: ReactNode; className?: string }) => (
  <b className={`one ${className ?? ""}`}>{children}</b>
);

/** Dải trạng thái (trước duyệt) + bìa xanh đậm + dải 4 con số nhu cầu đấu giá. */
export function PrintCover({ data }: { data: PostingPrintData }) {
  const { posting: p, status, branch, ownerName } = data;
  const band = statusBand(status.stage, postingCompletionPct(p), p.rejection_reason);
  const photos = p.image_urls ?? [];
  const location = [p.ward, p.district, p.province].filter(Boolean).join(", ") || p.address || "—";

  return (
    <>
      {band && (
        <div className={`band ${band.tone}`}>
          <span className="dot" />
          <b>{band.title}</b>
          <span>{band.text}</span>
        </div>
      )}

      <div className="cov">
        <div>
          <span className="eb">
            {PARENT_NAME[p.parent_slug] ?? p.parent_slug} · {CHILD_NAME[p.child_slug] ?? p.child_slug}
          </span>
          <h1>{p.title}</h1>
          <div className="facts">
            <div>
              <small>Mã hồ sơ</small>
              <One className="mono">{p.code}</One>
            </div>
            <div>
              <small>Ngày tạo</small>
              <One>{printDay(p.created_at)}</One>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <small>Vị trí</small>
              <One>{location}</One>
            </div>
            <div>
              <small>Chủ tài sản</small>
              <One>{ownerName ?? "—"}</One>
            </div>
            {branch && (
              <div style={{ gridColumn: "span 2" }}>
                <small>Chi nhánh</small>
                <One>{branch}</One>
              </div>
            )}
          </div>
        </div>
        <div className="pic">
          <Slot src={photos[0]} placeholder="Ảnh chính" className="main" />
          <div className="th">
            {photos.length > 1 ? <Slot src={photos[1]} placeholder="Ảnh 2" /> : <div className="more">—</div>}
            {photos.length > 2 ? <Slot src={photos[2]} placeholder="Ảnh 3" /> : <div className="more">—</div>}
            <div className="more">{photos.length > 3 ? `+${photos.length - 3} ảnh` : "Thiếu ảnh"}</div>
          </div>
        </div>
      </div>

      {auctionNeedsDeclared(p) ? (
        <div className="kn">
          <div>
            <small className="one">Giá khởi điểm</small>
            {p.starting_price ? <One>{formatMoneyShort(p.starting_price)}</One> : <One className="mu">Nhờ định giá</One>}
          </div>
          <div>
            <small className="one">Hình thức</small>
            <One>{AUCTION_FORMAT_LABELS[p.auction_format as AuctionFormat] ?? "—"}</One>
          </div>
          <div>
            <small className="one">Thù lao chấp nhận</small>
            <One>{commissionLabel(p.commission_pct)}</One>
          </div>
          <div>
            <small className="one">Thời gian kỳ vọng</small>
            <One>{p.expected_timeline ? EXPECTED_TIMELINE_LABELS[p.expected_timeline as ExpectedTimeline] : "—"}</One>
          </div>
        </div>
      ) : (
        <div className="kn e">
          <PrintEmpty
            icon="₫"
            title="Chưa khai nhu cầu đấu giá"
            text="Giá khởi điểm, hình thức và thù lao sẽ hiển thị khi hoàn tất bước “Nhu cầu đấu giá”."
          />
        </div>
      )}
    </>
  );
}
