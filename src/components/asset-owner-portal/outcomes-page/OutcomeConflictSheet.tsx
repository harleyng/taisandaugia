import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { AssetIdTag } from "@/components/asset-owner-portal/outcomes/AssetIdTag";
import { useOwnerOutcomeHistory } from "@/hooks/useOwnerOutcomesOverview";
import { useResolveOutcomeConflict } from "@/hooks/useOwnerOutcomeConflict";
import { overviewRowToTarget, type OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";
import type { OutcomeDialogTarget } from "@/lib/ownerOutcomeReport";
import type { OutcomeOverviewRow, OverviewSource } from "@/lib/ownerOutcomesOverview";
import { shortAssetId } from "@/lib/ownerAssetId";
import { DeleteOutcomeRoundDialog } from "./DeleteOutcomeRoundDialog";
import { OutcomeRoundHistory } from "./OutcomeRoundHistory";
import { OutcomeSourceCard } from "./OutcomeSourceCard";

const USE_LABEL: Record<string, string> = {
  org_report: "Dùng số của tổ chức",
  platform: "Dùng số của sàn",
  crawled: "Dùng số ước tính",
};

interface OutcomeConflictSheetProps {
  workspaceId: string;
  row: OutcomeOverviewRow | null;
  onClose: () => void;
  branchLabel: string | null;
  /** Ghi được kết quả của tài sản này (quyền write + phạm vi chi nhánh). */
  canWrite: boolean;
  onEdit: (record: OwnerOutcomeRecord) => void;
  onReportNext: (target: OutcomeDialogTarget) => void;
}

/**
 * Chi tiết một tài sản: các nguồn số liệu đặt cạnh nhau (xử lý "Lệch số liệu":
 * "Giữ số của tôi" / "Dùng số của tổ chức") + các lượt đơn vị đã khai.
 * Chọn số chỉ sửa bản ghi của chính đơn vị — không gửi gì cho tổ chức đấu giá.
 */
export function OutcomeConflictSheet({
  workspaceId,
  row,
  onClose,
  branchLabel,
  canWrite,
  onEdit,
  onReportNext,
}: OutcomeConflictSheetProps) {
  const history = useOwnerOutcomeHistory(workspaceId, row ? { listingId: row.listingId, titleKey: row.titleKey } : null);
  const resolve = useResolveOutcomeConflict(workspaceId);
  const [deleting, setDeleting] = useState<OwnerOutcomeRecord | null>(null);
  const records = history.data ?? [];

  const canResolve = canWrite && !!row?.listingId && row.hasConflict && !resolve.isPending;
  const own = row?.sources.find((s) => s.kind === "owner_report" && s.inRound);
  const canKeepMine = !!own && !(row?.bestKind === "platform" && own.disagrees);

  const actionFor = (s: OverviewSource, isWinner: boolean) => {
    if (!canResolve || !row?.listingId) return null;
    if (s.kind === "owner_report") {
      return canKeepMine && s.inRound ? (
        <Button size="sm" variant="outline" onClick={() => resolve.mutate({ listingId: row.listingId!, choice: "keep_mine" })}>
          Giữ số của tôi
        </Button>
      ) : null;
    }
    // `disagrees` của server so với nguồn THẮNG. Nguồn thắng dùng được khi số của
    // đơn vị lệch với nó (hoặc đơn vị chưa khai lượt này); sàn thắng thì chỉ số của sàn dùng được.
    const relevant = isWinner ? !own || own.disagrees : s.disagrees && row.bestKind !== "platform";
    const usable = relevant && !s.dismissed && s.inRound && !!s.fp && (s.outcome !== "sold" || s.price !== null);
    return usable && s.kind ? (
      <Button
        size="sm"
        variant="outline"
        onClick={() => resolve.mutate({ listingId: row.listingId!, choice: "use_source", sourceFp: s.fp })}
      >
        {USE_LABEL[s.kind] ?? "Dùng số này"}
      </Button>
    ) : null;
  };

  return (
    <>
      <Sheet open={!!row} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {row && (
            <div className="space-y-6">
              <SheetHeader className="space-y-1.5 text-left">
                <SheetTitle className="pr-10 leading-snug">{row.title}</SheetTitle>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.listingId ? (
                      <>
                        <AssetIdTag listingId={row.listingId} />
                        <CopyTextButton
                          text={shortAssetId(row.listingId)}
                          label="Sao chép mã"
                          className="h-7 px-2 text-xs"
                        />
                      </>
                    ) : (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        Tài sản ngoài sàn
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{branchLabel ?? "Toàn đơn vị"}</span>
                  </div>
                </SheetDescription>
              </SheetHeader>

              <section className="space-y-3">
                <h3 className="text-base font-semibold">Nguồn số liệu</h3>
                {row.hasConflict ? (
                  <p className="text-sm text-muted-foreground">
                    Các nguồn khác nhau về kết quả hoặc giá lệch hơn 1%. Chọn số đúng — lựa chọn chỉ sửa số của đơn vị,
                    tổ chức đấu giá không nhận được thông báo nào.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Các nguồn đang khớp nhau.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {row.sources.map((s, i) => (
                    <OutcomeSourceCard key={`${s.kind}-${s.refId ?? i}`} source={s} isWinner={i === 0} action={actionFor(s, i === 0)} />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">Các lượt đơn vị đã khai</h3>
                  {canWrite && (
                    <Button size="sm" onClick={() => onReportNext(overviewRowToTarget(row, records[0]))}>
                      Khai lượt tiếp theo
                    </Button>
                  )}
                </div>
                <OutcomeRoundHistory
                  records={records}
                  isLoading={history.isLoading}
                  canWrite={canWrite}
                  onEdit={onEdit}
                  onDelete={setDeleting}
                />
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <DeleteOutcomeRoundDialog workspaceId={workspaceId} record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
