import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import { ASSET_PHASE_META, type OwnerAssetRow } from "@/lib/ownerAssets";
import { StagePath } from "./StageTrack";

interface AssetDetailDialogProps {
  row: OwnerAssetRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCta: (row: OwnerAssetRow) => void;
}

/** Popup chi tiết tài sản: đường đi 4 bước, việc tiếp theo, vài dữ kiện chính, nơi xem sâu hơn. */
export function AssetDetailDialog({ row, open, onOpenChange, onCta }: AssetDetailDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-6 overflow-y-auto rounded-2xl sm:max-w-[560px]">
        {row && (
          <>
            <DialogHeader className="space-y-1 pr-8 text-left">
              <DialogTitle className="text-lg font-bold leading-snug">{row.title}</DialogTitle>
              <DialogDescription className="text-[13px]">
                {[row.code && `Mã ${row.code}`, row.category, row.province, row.branch].filter(Boolean).join(" · ")}
              </DialogDescription>
            </DialogHeader>

            <StagePath phase={row.phase} currentLabel={row.stepLabel} />

            {row.stage !== "da_thu_tien" && (
              <div className={cn("flex flex-col gap-2.5 rounded-xl px-4 py-3.5", row.next.mine ? "bg-warning/10" : "bg-muted")}>
                <small className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {row.next.mine ? "Việc của bạn" : `Đang chờ ${(row.next.waitingOn ?? "").toLowerCase()}`}
                </small>
                <p className="text-[14.5px] font-semibold">{row.next.text}</p>
                {row.next.cta && (
                  <div>
                    <Button size="sm" onClick={() => onCta(row)}>
                      {row.next.cta.label}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13.5px] tabular-nums">
              <dt className="text-muted-foreground">Giai đoạn</dt>
              <dd>
                {ASSET_PHASE_META[row.phase].label} · {row.stepLabel}
              </dd>
              {row.detail && (
                <>
                  <dt className="text-muted-foreground">Chi tiết</dt>
                  <dd>{row.detail}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Giá khởi điểm</dt>
              <dd>{formatMoneyShort(row.startingPrice)}</dd>
              {row.priceKind === "winning" && (
                <>
                  <dt className="text-muted-foreground">Giá trúng</dt>
                  <dd className="font-semibold">{formatMoneyShort(row.price)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Số lần đấu</dt>
              <dd>{row.rounds || "Chưa đấu"}</dd>
              {row.kind === "posting" && (
                <>
                  <dt className="text-muted-foreground">Tổ chức đấu giá</dt>
                  <dd>{row.orgName ?? "Chưa chọn"}</dd>
                </>
              )}
              {row.days !== null && (
                <>
                  <dt className="text-muted-foreground">Ở bước này</dt>
                  <dd className={cn(row.overdue && "font-semibold text-destructive")}>
                    {row.days} ngày{row.overdue && " · chậm tiến độ"}
                  </dd>
                </>
              )}
            </dl>

            {row.links.length > 0 && (
              <nav aria-label="Xem chi tiết">
                <h4 className="mb-1.5 text-[13px] font-semibold">Xem chi tiết ở</h4>
                {row.links.map((l) => (
                  <button
                    key={l.label}
                    type="button"
                    onClick={() => navigate(l.href)}
                    className="flex w-full items-center justify-between border-t border-border py-2.5 text-left text-[13.5px] font-medium text-primary hover:text-primary-hover"
                  >
                    {l.label}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ))}
              </nav>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
