import { CalendarClock, Coins, FileSignature, MapPin, Send, Tag } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { DetailHero, type HeroStat } from "@/components/shared/DetailHero";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { formatPrice } from "@/utils/formatters";
import { REVIEW_STATUS_BADGE_CLASS, REVIEW_STATUS_LABELS } from "@/lib/asset-posting/reviewStatus";
import { ASSET_POSTING_STATUS_LABELS, type AssetPosting, type AssetPostingStatus } from "@/types/asset-posting";

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.name]));
const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((c) => [c.slug, c.name])),
);

const STATUS_STYLE: Record<AssetPostingStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  matched: "bg-primary/10 text-primary",
  contracted: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}>{children}</span>;
}

interface AssetPostingHeroProps {
  posting: AssetPosting;
  /** Số tổ chức đã nhận hồ sơ (mọi trạng thái). */
  sentCount: number;
  /** Số báo giá đã nhận. */
  quoteCount: number;
  /** Đã có hợp đồng dịch vụ ở trạng thái `signed`. */
  hasSignedContract: boolean;
}

/**
 * Hero tóm tắt hồ sơ tài sản của chủ tài sản: trạng thái, tên, vài trường nhận
 * dạng (khu vực, giá khởi điểm) và hai con số của luồng ký gửi.
 *
 * Chi tiết đầy đủ nằm trong tab "Thông tin" — hero chỉ giữ thứ cần thấy ngay ở
 * MỌI tab, nên không nhồi thêm trường vào đây.
 */
export function AssetPostingHero({ posting: p, sentCount, quoteCount, hasSignedContract }: AssetPostingHeroProps) {
  const location = [p.ward, p.district, p.province].filter(Boolean).join(", ");

  // Chỉ hiện cụm số khi hồ sơ đã đi vào luồng ký gửi — hồ sơ vừa số hoá mà treo
  // hai số 0 to tướng ở góc phải thì đọc như lỗi.
  const stats: HeroStat[] =
    sentCount > 0
      ? [
          { icon: Send, label: "Đã gửi", value: sentCount },
          { icon: FileSignature, label: "Báo giá", value: quoteCount },
        ]
      : [];

  return (
    <DetailHero
      status={<Pill className={STATUS_STYLE[p.status]}>{ASSET_POSTING_STATUS_LABELS[p.status]}</Pill>}
      badges={
        <>
          <Pill className={REVIEW_STATUS_BADGE_CLASS[p.review_status]}>{REVIEW_STATUS_LABELS[p.review_status]}</Pill>
          {/* Suy ra từ hợp đồng — KHÔNG ghi asset_postings.status (trigger review guard). */}
          {hasSignedContract && <Pill className="bg-success/10 text-success">Đã ký hợp đồng</Pill>}
        </>
      }
      name={p.title}
      subtitle={
        <>
          <span className="inline-flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            {PARENT_NAME[p.parent_slug] ?? p.parent_slug} · {CHILD_LABEL[p.child_slug] ?? p.child_slug}
          </span>
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {location}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 shrink-0" />
            {p.starting_price ? formatPrice(p.starting_price, "TOTAL") : "Nhờ định giá"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            Tạo {format(new Date(p.created_at), "dd/MM/yyyy", { locale: vi })}
          </span>
        </>
      }
      stats={stats}
    />
  );
}
