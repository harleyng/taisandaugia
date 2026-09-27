import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useOwnerOutcomeHistory } from "@/hooks/useOwnerOutcomesOverview";
import { useResolveOutcomeConflict } from "@/hooks/useOwnerOutcomeConflict";
import { overviewRowToTarget, type OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";
import type { OutcomeDialogTarget } from "@/lib/ownerOutcomeReport";
import {
  conflictView,
  ledgerDay,
  ledgerMoney,
  outcomeText,
  sourceTrail,
  type LedgerRow,
} from "@/lib/ownerOutcomesLedger";
import { DeleteOutcomeRoundDialog } from "./DeleteOutcomeRoundDialog";
import { OutcomeRoundHistory } from "./OutcomeRoundHistory";
import { Dot, SourceDot } from "./SourceDot";

// Nút đóng mặc định của Sheet là con cuối — đổi thành ô vuông 32px nền xám như design.
const CLOSE_BTN =
  "[&>button:last-child]:right-4 [&>button:last-child]:top-4 [&>button:last-child]:flex [&>button:last-child]:h-8 [&>button:last-child]:w-8 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:rounded-lg [&>button:last-child]:bg-muted [&>button:last-child]:text-muted-foreground [&>button:last-child]:opacity-100";

interface OutcomeDetailDrawerProps {
  workspaceId: string;
  row: LedgerRow | null;
  onClose: () => void;
  branchLabel: string | null;
  /** Khai / sửa kết quả của tài sản này (ket-qua:update + phạm vi chi nhánh). */
  canWrite: boolean;
  /** Xoá lượt đã khai (ket-qua:delete + phạm vi chi nhánh). */
  canDelete: boolean;
  onEdit: (record: OwnerOutcomeRecord) => void;
  onReportNext: (target: OutcomeDialogTarget) => void;
}

/**
 * Ngăn chi tiết một dòng sổ: con số + nguồn, thông tin phiên, "Nguồn của con số";
 * các lượt đơn vị đã khai (sửa / xoá / khai lượt tiếp) gập bên dưới.
 */
export function OutcomeDetailDrawer({
  workspaceId,
  row,
  onClose,
  branchLabel,
  canWrite,
  canDelete,
  onEdit,
  onReportNext,
}: OutcomeDetailDrawerProps) {
  const history = useOwnerOutcomeHistory(
    workspaceId,
    row ? { listingId: row.listingId, titleKey: row.titleKey } : null,
  );
  const resolve = useResolveOutcomeConflict(workspaceId);
  const [deleting, setDeleting] = useState<OwnerOutcomeRecord | null>(null);
  const records = history.data ?? [];
  const own = row?.ownOutcomeId ? (records.find((r) => r.id === row.ownOutcomeId) ?? null) : null;
  const sold = row?.outcome === "sold" && row.price !== null;
  const conflictActions = row?.hasConflict && row.listingId && canWrite ? conflictView(row).actions : [];

  return (
    <>
      <Sheet open={!!row} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className={cn("flex w-full flex-col gap-5 overflow-y-auto p-6 sm:max-w-[440px]", CLOSE_BTN)}>
          {row && (
            <>
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="pr-10 text-lg font-bold leading-snug [text-wrap:pretty]">{row.title}</SheetTitle>
                <SheetDescription className="text-[13px] tabular-nums">
                  {[row.orgName ?? (row.listingId ? null : "Tài sản ngoài sàn"), row.address]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-0.5 tabular-nums">
                <small className="text-[12.5px] text-muted-foreground">{sold ? "Giá trúng" : "Kết quả"}</small>
                <b className="text-[32px] font-bold leading-tight tracking-[-0.02em] text-primary-hover">
                  {sold ? ledgerMoney(row.price) : outcomeText(row.outcome)}
                </b>
                <SourceDot confidence={row.confidence} />
              </div>

              <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13.5px] tabular-nums">
                <dt className="text-muted-foreground">Ngày đấu</dt>
                <dd>{ledgerDay(row.date)}</dd>
                <dt className="text-muted-foreground">Giá khởi điểm</dt>
                <dd>{ledgerMoney(row.startingPrice)}</dd>
                <dt className="text-muted-foreground">Chi nhánh</dt>
                <dd>{branchLabel ?? "Toàn đơn vị"}</dd>
                <dt className="text-muted-foreground">Vòng đấu</dt>
                <dd>{row.round ? `Vòng ${row.round}` : "—"}</dd>
              </dl>

              <section>
                <h4 className="mb-2 text-[13px] font-semibold">Nguồn của con số</h4>
                <ol>
                  {sourceTrail(row).map((s, i) => (
                    <li key={i} className="grid grid-cols-[14px_minmax(0,1fr)] gap-2.5 py-2 text-[13px]">
                      <Dot confidence={s.confidence} className="mt-1.5" />
                      <span>
                        {s.title}
                        <small className="block text-[12.5px] tabular-nums text-muted-foreground">{s.detail}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              {(conflictActions.length > 0 || (canWrite && own)) && (
                <div className="flex flex-wrap gap-2">
                  {conflictActions.map((a) => (
                    <Button
                      key={a.label}
                      variant="outline"
                      disabled={resolve.isPending}
                      onClick={() =>
                        resolve.mutate(
                          a.choice === "keep_mine"
                            ? { listingId: row.listingId!, choice: "keep_mine" }
                            : { listingId: row.listingId!, choice: "use_source", sourceFp: a.sourceFp },
                        )
                      }
                    >
                      {a.label}
                    </Button>
                  ))}
                  {canWrite && own && row.confidence === "self_reported" && own.outcome === "sold" && (
                    <Button onClick={() => onEdit(own)}>Đính kèm biên bản</Button>
                  )}
                  {canWrite && own && row.bestKind !== "platform" && (
                    <Button variant="outline" onClick={() => onEdit(own)}>
                      Sửa kết quả
                    </Button>
                  )}
                </div>
              )}

              <Collapsible className="border-t pt-3">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Các lượt đơn vị đã khai{records.length ? ` (${records.length})` : ""}
                  <ChevronDown
                    className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReportNext(overviewRowToTarget(row, records[0]))}
                    >
                      Khai lượt tiếp theo
                    </Button>
                  )}
                  <OutcomeRoundHistory
                    records={records}
                    isLoading={history.isLoading}
                    canWrite={canWrite}
                    canDelete={canDelete}
                    onEdit={onEdit}
                    onDelete={setDeleting}
                  />
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </SheetContent>
      </Sheet>

      <DeleteOutcomeRoundDialog workspaceId={workspaceId} record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
