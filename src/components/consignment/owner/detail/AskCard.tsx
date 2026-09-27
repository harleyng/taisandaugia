import { formatMoneyShort } from "@/utils/money";
import { formatPct } from "@/lib/consignment/ownerConsignmentView";
import { AUCTION_FORMAT_LABELS, EXPECTED_TIMELINE_LABELS, type AssetPosting } from "@/types/asset-posting";
import { KgCard } from "./KgCard";

interface AskCardProps {
  posting: AssetPosting;
  /** "Sàn chọn giúp" hoặc "3/5 tổ chức". */
  sentLine: string;
  /** Có ⇒ nút "Sửa" (mở lại wizard — chỉ trước khi gửi tổ chức nào). */
  onEdit?: () => void;
}

/** Những gì chủ tài sản đã khai khi số hoá — để đối chiếu với báo giá. */
export function AskCard({ posting: p, sentLine, onEdit }: AskCardProps) {
  const rows: [string, string][] = [
    ["Thù lao chấp nhận", p.commission_pct != null ? `≤ ${formatPct(p.commission_pct)}` : "Theo đề xuất"],
    ["Hình thức", AUCTION_FORMAT_LABELS[p.auction_format] ?? p.auction_format],
    ["Thời gian kỳ vọng", p.expected_timeline ? EXPECTED_TIMELINE_LABELS[p.expected_timeline] : "—"],
    ["Đã gửi", sentLine],
  ];
  return (
    <KgCard
      title="Yêu cầu của bạn"
      aux={
        onEdit && (
          <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-primary hover:underline">
            Sửa
          </button>
        )
      }
    >
      <p className="text-[12.5px] text-muted-foreground">Giá khởi điểm mong muốn</p>
      <p className="mb-3.5 mt-0.5 text-[26px] font-bold tabular-nums tracking-[-0.02em] text-foreground">
        {p.starting_price != null ? (
          formatMoneyShort(p.starting_price)
        ) : (
          <span className="text-lg text-foreground/70">Nhờ tổ chức định giá</span>
        )}
      </p>
      <dl className="flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-t border-border py-[9px] text-[13.5px]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-semibold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </KgCard>
  );
}

