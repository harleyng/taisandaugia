import { useRef, useState } from "react";
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
import { useImportPlanItems } from "@/hooks/useAuctionPlan";
import {
  PLAN_IMPORT_MAX_ROWS,
  classifyPlanItemRows,
  downloadPlanItemIssues,
  downloadPlanItemsTemplate,
  parsePlanItemsFile,
  type ClassifiedPlanItems,
  type PlanItemIssue,
} from "@/lib/auctionPlan/itemsImport";
import type { AuctionPlan } from "@/lib/auctionPlan/types";
import { PlanItemIssueList, PlanItemsImportPreview } from "./PlanItemsImportPreview";

type Step =
  | { kind: "pick" }
  | { kind: "preview"; fileName: string; result: ClassifiedPlanItems }
  | { kind: "done"; written: number; issues: PlanItemIssue[] };

interface PlanItemsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AuctionPlan;
}

/**
 * "Nhập từ Excel": tải mẫu → chọn file → xem trước (dòng lỗi nêu lý do) → ghi
 * CÁC DÒNG HỢP LỆ. Cùng khuôn `OutcomeImportDialog`.
 *
 * Cả lô vào trong một câu insert nên nếu DB từ chối thì không dòng nào được ghi —
 * tốt hơn là nửa danh mục nằm trong kế hoạch mà người dùng không biết.
 */
export function PlanItemsImportDialog({ open, onOpenChange, plan }: PlanItemsImportDialogProps) {
  const importM = useImportPlanItems(plan);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const parsed = await parsePlanItemsFile(file);
      if (parsed.missingColumns.length) {
        setError(`File thiếu cột: ${parsed.missingColumns.join(", ")}. Hãy dùng file mẫu.`);
      } else if (!parsed.rows.length) {
        setError("File chưa có dòng dữ liệu nào.");
      } else {
        setStep({
          kind: "preview",
          fileName: file.name,
          result: classifyPlanItemRows(parsed.rows, { planYear: plan.plan_year, assetType: "land_use_right" }),
        });
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
    importM.mutate(
      result.valid.map((v) => v.payload),
      { onSuccess: (written) => setStep({ kind: "done", written, issues: result.invalid }) },
    );
  };

  const tooMany = step.kind === "preview" && step.result.valid.length > PLAN_IMPORT_MAX_ROWS;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Nhập danh mục từ Excel</DialogTitle>
          <DialogDescription>
            {step.kind === "preview"
              ? step.fileName
              : "Mỗi dòng là một lô đất / tài sản. File dùng đúng bảy cột của biểu mẫu kế hoạch."}
          </DialogDescription>
        </DialogHeader>

        {step.kind === "pick" && (
          <div className="space-y-3">
            <label
              htmlFor="plan-import-file"
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center transition-colors hover:bg-muted/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void readFile(e.dataTransfer.files?.[0]);
              }}
            >
              <IconTile icon={FileSpreadsheet} size="lg" className={reading ? "animate-pulse" : undefined} />
              <span className="text-sm font-medium text-foreground">
                {reading ? "Đang đọc file…" : "Chọn hoặc kéo thả file .xlsx / .csv"}
              </span>
              <span className="text-xs text-muted-foreground">Tối đa {PLAN_IMPORT_MAX_ROWS} dòng mỗi lần.</span>
            </label>
            <input
              ref={fileRef}
              id="plan-import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={reading}
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="link" className="h-auto p-0" onClick={() => downloadPlanItemsTemplate(plan.plan_year)}>
              Tải file mẫu
            </Button>
          </div>
        )}

        {step.kind === "preview" && (
          <div className="space-y-3">
            <PlanItemsImportPreview result={step.result} />
            {tooMany && (
              <p className="text-sm text-destructive">
                File có hơn {PLAN_IMPORT_MAX_ROWS} dòng hợp lệ — hãy chia thành nhiều file.
              </p>
            )}
          </div>
        )}

        {step.kind === "done" && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Đã ghi <span className="font-semibold tabular-nums">{step.written}</span> tài sản
              {step.issues.length > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold tabular-nums text-destructive">{step.issues.length}</span> dòng chưa ghi
                </>
              )}
              .
            </p>
            <PlanItemIssueList issues={step.issues} title="Dòng chưa ghi" />
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
                <Button variant="outline" disabled={importM.isPending} onClick={() => downloadPlanItemIssues(step.result.invalid)}>
                  Tải danh sách lỗi
                </Button>
              )}
              <Button disabled={!step.result.valid.length || tooMany || importM.isPending} onClick={write}>
                {importM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ghi {step.result.valid.length} tài sản
              </Button>
            </>
          )}
          {step.kind === "done" && (
            <>
              {step.issues.length > 0 && (
                <Button variant="outline" onClick={() => downloadPlanItemIssues(step.issues)}>
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
