import { useState } from "react";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePostingAuctionConsultations } from "@/hooks/useAuctionConsultations";
import { summarizeAuctionConsultations } from "@/lib/auctionConsult/status";
import { ActiveAuctionConsult } from "./ActiveAuctionConsult";
import { AuctionConsultHistory } from "./AuctionConsultHistory";
import { AuctionConsultResult } from "./AuctionConsultResult";
import { RequestAuctionConsultDialog, type AuctionConsultPrefill } from "./RequestAuctionConsultDialog";
import { ServiceBanner, ServiceBannerButton } from "@/components/asset-posting/ServiceBanner";

interface PostingAuctionConsultCardProps {
  /** null khi hồ sơ trong wizard chưa từng được lưu. */
  postingId: string | null;
  /** owner: gửi / thanh toán / quyết định · admin: xem tiến trình + đề xuất. */
  mode: "owner" | "admin";
  /** Wizard truyền hàm tự lưu nháp; mặc định dùng postingId sẵn có. */
  resolvePostingId?: () => Promise<string | null>;
  /** Hồ sơ đã kết thúc (huỷ / đã ký hợp đồng) ⇒ không gửi yêu cầu mới. */
  locked?: boolean;
  /** Giá / hình thức / tiến độ hiện tại của hồ sơ để điền sẵn form. */
  prefill?: AuctionConsultPrefill;
  /** Hiện các phiên bản cũ (trang hồ sơ). */
  showHistory?: boolean;
  /** "banner": banner gọn đầu bước 4 của wizard số hoá (thiết kế v3). */
  variant?: "card" | "banner";
}

/** Khối "Tư vấn đấu giá" của một hồ sơ số hoá — yêu cầu đang chạy, đề xuất hiện hành, phiên bản trước. */
export function PostingAuctionConsultCard({
  postingId,
  mode,
  resolvePostingId,
  locked,
  prefill,
  showHistory,
  variant = "card",
}: PostingAuctionConsultCardProps) {
  const [open, setOpen] = useState(false);
  // Người xem / Cán bộ ngoài phạm vi chi nhánh chỉ xem.
  const canWrite = usePostingCanWrite();
  const { data: rows = [], isLoading } = usePostingAuctionConsultations(postingId);
  const { active, current, versions } = summarizeAuctionConsultations(rows);
  const resolve = resolvePostingId ?? (async () => postingId);
  const loading = !!postingId && isLoading;

  const canRequest = mode === "owner" && canWrite && !loading && !active && !locked;
  const dialog = mode === "owner" && canWrite && (
    <RequestAuctionConsultDialog
      open={open}
      onOpenChange={setOpen}
      resolvePostingId={resolve}
      prefill={prefill}
      isFollowUp={!!current}
    />
  );

  if (variant === "banner") {
    return (
      <>
        <ServiceBanner
          icon={<Lightbulb />}
          title="Tư vấn đấu giá"
          desc="Đề xuất hình thức, giá khởi điểm, bước giá, tiền đặt trước"
          status={active ? { text: "Đã gửi yêu cầu", tone: "warn" } : current ? { text: "Đã có đề xuất", tone: "ok" } : null}
          action={
            canRequest && (
              <ServiceBannerButton onClick={() => setOpen(true)} quiet={!!current}>
                {current ? "Yêu cầu phương án mới" : "Yêu cầu tư vấn đấu giá"}
              </ServiceBannerButton>
            )
          }
        >
          {(active || current) && (
            <>
              {current && <AuctionConsultResult row={current} mode={mode} />}
              {active && <ActiveAuctionConsult row={active} mode={mode} />}
            </>
          )}
        </ServiceBanner>
        {dialog}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tư vấn đấu giá…
        </div>
      ) : current ? (
        <AuctionConsultResult row={current} mode={mode} />
      ) : (
        !active && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-input bg-background p-4">
            <Lightbulb className="h-8 w-8 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {mode === "owner"
                ? "Chưa có đề xuất. Nêu mục tiêu bán để chuyên gia đề xuất hình thức, giá khởi điểm, bước giá, thời lượng và tiền đặt trước trước khi lập phiên."
                : "Hồ sơ chưa có tư vấn đấu giá."}
            </p>
          </div>
        )
      )}

      {active && <ActiveAuctionConsult row={active} mode={mode} />}

      {canRequest && (
        <Button type="button" variant={current ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
          <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
          {current ? "Yêu cầu phương án mới" : "Yêu cầu tư vấn đấu giá"}
        </Button>
      )}

      {showHistory && <AuctionConsultHistory versions={versions} mode={mode} />}

      {dialog}
    </div>
  );
}
