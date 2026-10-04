import { useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { ServiceBanner, ServiceBannerButton } from "@/components/asset-posting/ServiceBanner";
import { usePostingValuationOrders } from "@/hooks/useValuationOrders";
import { summarizeValuations } from "@/lib/valuation/status";
import { ActiveValuationOrder } from "./ActiveValuationOrder";
import { RequestValuationDialog } from "./RequestValuationDialog";
import { ValuationResult } from "./ValuationResult";

interface PostingValuationCardProps {
  /** null khi hồ sơ trong wizard chưa từng được lưu. */
  postingId: string | null;
  /** owner: gửi / thanh toán / thẩm định lại · admin: xem tiến trình + kết quả. */
  mode: "owner" | "admin";
  /** Wizard truyền hàm tự lưu nháp; mặc định dùng postingId sẵn có. */
  resolvePostingId?: () => Promise<string | null>;
  /** Hồ sơ đã kết thúc (huỷ / đã ký hợp đồng) ⇒ không gửi yêu cầu mới. */
  locked?: boolean;
  /** "banner": banner gọn trong bước 4 của wizard số hoá. */
  variant?: "card" | "banner";
}

/** Khối "Thẩm định giá qua sàn" của một hồ sơ — đơn đang chạy + kết quả hiện hành. */
export function PostingValuationCard({ postingId, mode, resolvePostingId, locked, variant = "card" }: PostingValuationCardProps) {
  const [open, setOpen] = useState(false);
  const canWrite = usePostingCanWrite();
  const { data: rows = [], isLoading } = usePostingValuationOrders(postingId);
  const { active, current } = summarizeValuations(rows);
  const resolve = resolvePostingId ?? (async () => postingId);
  const loading = !!postingId && isLoading;

  const canRequest = mode === "owner" && canWrite && !loading && !active && !locked;
  const label = current ? "Thẩm định giá lại" : "Yêu cầu thẩm định giá";
  const dialog = mode === "owner" && canWrite && (
    <RequestValuationDialog open={open} onOpenChange={setOpen} resolvePostingId={resolve} isFollowUp={!!current} />
  );

  if (variant === "banner") {
    return (
      <>
        <ServiceBanner
          icon={<Calculator />}
          title="Thẩm định giá qua sàn"
          desc="Đơn vị thẩm định giá của sàn định giá và cấp chứng thư"
          status={active ? { text: "Đã gửi yêu cầu", tone: "warn" } : current ? { text: "Đã có chứng thư", tone: "ok" } : null}
          action={
            canRequest && (
              <ServiceBannerButton onClick={() => setOpen(true)} quiet={!!current}>
                {label}
              </ServiceBannerButton>
            )
          }
        >
          {(active || current) && (
            <>
              {current && <ValuationResult row={current} compact />}
              {active && <ActiveValuationOrder row={active} mode={mode} />}
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
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải thẩm định giá…
        </div>
      ) : current ? (
        <ValuationResult row={current} />
      ) : (
        !active && (
          <p className="rounded-xl border border-dashed border-input bg-background p-4 text-sm text-muted-foreground">
            {mode === "owner" ? "Chưa thẩm định giá qua sàn." : "Hồ sơ chưa có thẩm định giá qua sàn."}
          </p>
        )
      )}
      {active && <ActiveValuationOrder row={active} mode={mode} />}
      {canRequest && (
        <Button type="button" variant={current ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
          <Calculator className="mr-1.5 h-3.5 w-3.5" />
          {label}
        </Button>
      )}
      {dialog}
    </div>
  );
}
