import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconTile } from "@/components/asset-owner-portal/ui/IconTile";
import { useAuctionOrgDirectory } from "@/hooks/useAuctionOrgDirectory";
import { useAssetOwnerWorkspace } from "@/hooks/useAssetOwnerWorkspace";
import { useClaimWriteAccess, useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useImportOwnerOutcomes } from "@/hooks/useOwnerOutcomeImport";
import {
  OUTCOME_IMPORT_MAX_ROWS,
  classifyOutcomeRows,
  downloadOutcomeIssues,
  downloadOutcomeTemplate,
  parseOutcomeFile,
  type ClassifiedImport,
  type ImportContext,
  type ImportIssue,
} from "@/lib/ownerOutcomeImport";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { ImportIssueList, OutcomeImportPreview } from "./OutcomeImportPreview";

const LIVE = new Set(["auto_claimed", "pending_confirmation", "confirmed"]);

type Step =
  | { kind: "pick" }
  | { kind: "preview"; fileName: string; result: ClassifiedImport }
  | { kind: "done"; written: number; issues: ImportIssue[]; serverFailures: number };

interface OutcomeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  branches: { id: string; label: string }[];
}

/** "Nhập từ Excel": tải mẫu → chọn file → xem trước (dòng lỗi nêu lý do) → ghi các dòng hợp lệ. */
export function OutcomeImportDialog({ open, onOpenChange, workspaceId, branches }: OutcomeImportDialogProps) {
  const { claims, claimsLoading } = useAssetOwnerWorkspace();
  const { isScoped, branchScope } = useOwnerWorkspace();
  const { canOnClaim } = useClaimWriteAccess();
  const { data: orgs = [], isLoading: orgsLoading } = useAuctionOrgDirectory();
  const importM = useImportOwnerOutcomes(workspaceId);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ctx = useMemo<ImportContext>(() => {
    const live = claims.filter((c) => c.listing_id && LIVE.has(c.status));
    const byListing = new Map(live.map((c) => [c.listing_id!, c]));
    return {
      listings: live.map((c) => ({ id: c.listing_id!, title: c.listing?.title ?? "" })),
      branches,
      orgs,
      branchScope: isScoped ? branchScope : null,
      canWriteListing: (id) => {
        const claim = byListing.get(id);
        return !!claim && canOnClaim("ket-qua", "update", claim);
      },
      today: todayIso(),
    };
  }, [claims, branches, orgs, isScoped, branchScope, canOnClaim]);

  const reset = () => {
    setStep({ kind: "pick" });
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = (v: boolean) => {
    if (importM.isPending) return;
    if (!v) reset();
    onOpenChange(v);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setReading(true);
    try {
      const parsed = await parseOutcomeFile(file);
      if (parsed.missingColumns.length) {
        setError(`File thiếu cột: ${parsed.missingColumns.join(", ")}. Hãy dùng file mẫu.`);
      } else if (!parsed.rows.length) {
        setError("File chưa có dòng dữ liệu nào.");
      } else {
        setStep({ kind: "preview", fileName: file.name, result: classifyOutcomeRows(parsed.rows, ctx) });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được file.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const write = () => {
    if (step.kind !== "preview") return;
    const { result } = step;
    importM.mutate(result.valid, {
      onSuccess: ({ written, failures }) =>
        setStep({ kind: "done", written, issues: [...result.invalid, ...failures], serverFailures: failures.length }),
    });
  };

  const loadingCtx = claimsLoading || orgsLoading;
  const tooMany = step.kind === "preview" && step.result.valid.length > OUTCOME_IMPORT_MAX_ROWS;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Nhập kết quả từ Excel</DialogTitle>
          <DialogDescription>
            {step.kind === "preview"
              ? step.fileName
              : "Mỗi dòng là một lượt đấu giá. Tài sản trên sàn nhận theo mã tài sản; không có mã thì theo tên."}
          </DialogDescription>
        </DialogHeader>

        {step.kind === "pick" && (
          <div className="space-y-3">
            <label
              htmlFor="oc-import-file"
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center transition-colors hover:bg-muted/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void readFile(e.dataTransfer.files?.[0]);
              }}
            >
              <IconTile icon={FileSpreadsheet} size="lg" className={reading || loadingCtx ? "animate-pulse" : undefined} />
              <span className="text-sm font-medium text-foreground">
                {loadingCtx ? "Đang tải danh mục tài sản…" : reading ? "Đang đọc file…" : "Chọn hoặc kéo thả file .xlsx / .csv"}
              </span>
              <span className="text-xs text-muted-foreground">Tối đa {OUTCOME_IMPORT_MAX_ROWS} dòng mỗi lần.</span>
            </label>
            <input
              ref={fileRef}
              id="oc-import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={loadingCtx || reading}
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="link" className="h-auto p-0" onClick={downloadOutcomeTemplate}>
              Tải file mẫu
            </Button>
          </div>
        )}

        {step.kind === "preview" && (
          <div className="space-y-3">
            <OutcomeImportPreview result={step.result} />
            {tooMany && (
              <p className="text-sm text-destructive">
                File có hơn {OUTCOME_IMPORT_MAX_ROWS} dòng hợp lệ — hãy chia thành nhiều file.
              </p>
            )}
          </div>
        )}

        {step.kind === "done" && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Đã ghi <span className="font-semibold tabular-nums">{step.written}</span> dòng
              {step.issues.length ? (
                <>
                  {" · "}
                  <span className="font-semibold tabular-nums text-destructive">{step.issues.length}</span> dòng chưa ghi
                </>
              ) : null}
              .
            </p>
            <ImportIssueList issues={step.issues} title="Dòng chưa ghi" />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step.kind === "pick" && (
            <Button variant="outline" onClick={() => close(false)}>
              Đóng
            </Button>
          )}
          {step.kind === "preview" && (
            <>
              <Button variant="outline" disabled={importM.isPending} onClick={reset}>
                Chọn file khác
              </Button>
              {step.result.invalid.length > 0 && (
                <Button variant="outline" disabled={importM.isPending} onClick={() => downloadOutcomeIssues(step.result.invalid)}>
                  Tải danh sách lỗi
                </Button>
              )}
              <Button disabled={!step.result.valid.length || tooMany || importM.isPending} onClick={write}>
                {importM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ghi {step.result.valid.length} dòng
              </Button>
            </>
          )}
          {step.kind === "done" && (
            <>
              {step.issues.length > 0 && (
                <Button variant="outline" onClick={() => downloadOutcomeIssues(step.issues)}>
                  Tải danh sách dòng chưa ghi
                </Button>
              )}
              <Button onClick={() => close(false)}>Xong</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
