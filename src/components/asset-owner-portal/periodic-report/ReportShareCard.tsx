import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { copyShareLink, useReportShareLink, useRevokeReportShare, useShareReport } from "@/hooks/useOwnerReportShare";
import type { OwnerReport } from "@/lib/ownerPeriodicReport";
import { reportShareState, shareStatusLine, sharedReportUrl } from "@/lib/ownerReportShare";
import { ShareReportDialog } from "./ShareReportDialog";
import { RevokeShareDialog } from "./RevokeShareDialog";

interface ReportShareCardProps {
  /** Báo cáo ĐÃ CHỐT (bản nháp không chia sẻ được). */
  report: OwnerReport;
  /** 'send_report' — chỉ Trưởng đơn vị thấy link và tạo / gia hạn / thu hồi được. */
  canShare: boolean;
  /** Vừa "Chốt & chia sẻ" ⇒ mở luôn hộp tạo link. */
  openOnMount?: boolean;
}

/**
 * "Chia sẻ với trụ sở" (Phase 11): link chỉ đọc /r/:token cho báo cáo đã chốt.
 * Trưởng đơn vị: tạo / sao chép / gia hạn / thu hồi. Thành viên khác: chỉ thấy trạng thái
 * (server không trả token cho họ).
 */
export function ReportShareCard({ report, canShare, openOnMount = false }: ReportShareCardProps) {
  const state = reportShareState(report.share);
  const link = useReportShareLink(report, canShare && state === "active");
  const share = useShareReport(report);
  const revoke = useRevokeReportShare(report);
  const [shareOpen, setShareOpen] = useState(() => openOnMount && canShare && state !== "active");
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = state === "active" ? link.data?.token ?? null : null;
  const url = token ? sharedReportUrl(token) : "";
  const status = shareStatusLine(report.share, state);
  const heading =
    state === "active" ? "Đang chia sẻ qua link chỉ đọc" : state === "expired" ? "Link chia sẻ đã hết hạn" : "Chưa chia sẻ";
  let description = status;
  if (state === "none") {
    description = canShare
      ? "Tạo link chỉ đọc để gửi trụ sở — người nhận không cần đăng nhập. Link có hạn dùng và thu hồi được bất cứ lúc nào."
      : "Chỉ Trưởng đơn vị tạo được link chia sẻ.";
    // Link cũ đã thu hồi: giữ lịch sử lượt xem.
    if (report.share.viewCount > 0) description += ` Link trước đó: ${status}.`;
  } else if (state === "active" && !canShare) {
    description = `${status} · liên hệ Trưởng đơn vị để nhận link`;
  }

  const onCopy = async () => {
    if (!token) return;
    if (await copyShareLink(token)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("Đã sao chép link");
    } else {
      toast.error("Trình duyệt chặn sao chép — hãy chọn link và sao chép thủ công.");
    }
  };

  return (
    <SectionCard title="Chia sẻ với trụ sở" icon={Link2}>
      {state === "active" && canShare && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {link.isLoading ? (
              <Skeleton className="h-10 flex-1 rounded-md" />
            ) : (
              <Input
                readOnly
                value={url}
                placeholder={link.isError ? "Chưa tải được link" : ""}
                aria-label="Link chia sẻ chỉ đọc"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 font-mono text-xs"
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={!token}
                  aria-label="Sao chép link chia sẻ"
                  onClick={() => void onCopy()}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" strokeWidth={1.5} />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sao chép link</TooltipContent>
            </Tooltip>
          </div>
          {link.isError && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={() => void link.refetch()}>
              Tải lại link
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Mobile: dòng trạng thái chiếm cả hàng, nút xuống hàng dưới. */}
        <div className="w-full min-w-0 space-y-0.5 sm:w-auto sm:flex-1">
          <p className="text-sm text-foreground">{heading}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        {canShare && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {state === "active" ? (
              <>
                <Button variant="outline" size="sm" disabled={share.isPending} onClick={() => setShareOpen(true)}>
                  Gia hạn
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={revoke.isPending}
                  onClick={() => setRevokeOpen(true)}
                >
                  Thu hồi
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShareOpen(true)}>
                <Link2 className="h-4 w-4" strokeWidth={1.5} />
                {state === "expired" ? "Tạo link mới" : "Tạo link"}
              </Button>
            )}
          </div>
        )}
      </div>

      <ShareReportDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        mode={state === "active" ? "extend" : "create"}
        busy={share.isPending}
        onConfirm={(days) => share.mutate(days, { onSuccess: () => setShareOpen(false) })}
      />
      <RevokeShareDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        busy={revoke.isPending}
        onConfirm={() => revoke.mutate(undefined, { onSuccess: () => setRevokeOpen(false) })}
      />
    </SectionCard>
  );
}
