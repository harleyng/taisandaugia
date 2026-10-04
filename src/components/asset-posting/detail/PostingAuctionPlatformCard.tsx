import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { KvList } from "./detailParts";

interface PostingAuctionPlatformCardProps {
  sentCount: number;
  quotedCount: number;
  /** Đã nhờ sàn chọn giúp. */
  viaBroker: boolean;
  /** Tổ chức đã chốt (hợp đồng / báo giá được chọn). */
  orgName: string | null;
  /** Có ⇒ nút mở trang Ký gửi đấu giá (báo giá, hợp đồng). */
  onOpenConsignment?: () => void;
}

/** Nhánh "Dịch vụ của sàn" của tab Đấu giá — tình trạng tìm tổ chức qua sàn, dẫn sang Ký gửi. */
export function PostingAuctionPlatformCard({
  sentCount,
  quotedCount,
  viaBroker,
  orgName,
  onOpenConsignment,
}: PostingAuctionPlatformCardProps) {
  const started = sentCount > 0 || viaBroker;
  return (
    <SectionCard
      title="Tìm tổ chức qua sàn"
      actions={
        onOpenConsignment && (
          <Button size="sm" variant="outline" onClick={onOpenConsignment}>
            Mở Ký gửi đấu giá <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )
      }
    >
      {started ? (
        <KvList
          rows={[
            { k: "Cách tìm", v: viaBroker ? "Nhờ sàn chọn giúp" : "Tự chọn tổ chức" },
            { k: "Đã gửi yêu cầu", v: `${sentCount} tổ chức` },
            { k: "Đã báo giá", v: `${quotedCount} tổ chức` },
            { k: "Tổ chức đã chọn", v: orgName ?? "—" },
          ]}
        />
      ) : (
        <p className="text-[13.5px] text-foreground/70">
          Chưa gửi hồ sơ cho tổ chức nào. Sau khi hồ sơ được sàn duyệt, bạn tự chọn tổ chức hoặc nhờ sàn chọn giúp để
          nhận báo giá ở trang Ký gửi đấu giá.
        </p>
      )}
    </SectionCard>
  );
}
