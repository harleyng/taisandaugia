import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Stamp, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  PLAN_DOC_ACCEPT,
  uploadPlanDoc,
  useRecordPlanApproval,
} from "@/hooks/useAuctionPlanApproval";
import { todayIso } from "@/lib/ownerOutcomeReport";
import type { AuctionPlan } from "@/lib/auctionPlan/types";

interface RecordApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AuctionPlan;
}

const Star = () => <span className="text-destructive">*</span>;

/**
 * "Ghi nhận phê duyệt" (quyết định D5): quyết định được KÝ NGOÀI ứng dụng, app
 * chỉ ghi lại số, ngày và tệp đã ký. Không có bước ký trong app.
 *
 * ⚠️ Thứ tự bắt buộc: tải tệp lên bucket TRƯỚC, rồi mới gọi RPC với đường dẫn —
 * `auction_plan_record_approval` từ chối đường dẫn ngoài `{Trạm}/{kế hoạch}/`
 * hoặc không tồn tại thật trong storage. Bucket không có policy UPDATE nên mỗi
 * lần tải là một TÊN MỚI.
 */
export function RecordApprovalDialog({ open, onOpenChange, plan }: RecordApprovalDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(todayIso());
  const [paths, setPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const recordM = useRecordPlanApproval(plan);
  const today = todayIso();

  useEffect(() => {
    if (!open) return;
    setDocNo(plan.approval_doc_no ?? "");
    setDocDate(plan.approval_doc_date ?? todayIso());
    setPaths([]);
  }, [open, plan.approval_doc_no, plan.approval_doc_date]);

  const busy = uploading || recordM.isPending;
  const invalid = !docNo.trim() || !docDate || docDate > today;

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const added: string[] = [];
      for (const file of Array.from(files)) {
        added.push(await uploadPlanDoc(plan.workspace_id, plan.id, file));
      }
      setPaths((prev) => [...prev, ...added]);
      toast.success(added.length > 1 ? `Đã tải ${added.length} tệp lên` : "Đã tải tệp quyết định lên");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được tệp lên.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Ghi nhận phê duyệt kế hoạch</DialogTitle>
          <DialogDescription>
            Quyết định phê duyệt được ký ngoài ứng dụng. Phần này ghi lại số, ngày và bản đã ký, rồi đóng băng danh mục
            thành bản mốc v{plan.baseline_version + 1}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="plan-doc-no" className="text-sm font-medium text-foreground">
                Số quyết định <Star />
              </label>
              <Input
                id="plan-doc-no"
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
                placeholder="1234/QĐ-UBND"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="plan-doc-date" className="text-sm font-medium text-foreground">
                Ngày quyết định <Star />
              </label>
              <Input
                id="plan-doc-date"
                type="date"
                max={today}
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Bản quyết định đã ký</p>
            {paths.length > 0 && (
              <ul className="space-y-1.5">
                {paths.map((path) => (
                  <li
                    key={path}
                    className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm text-foreground"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{path.split("/").pop()}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive"
                      aria-label="Bỏ tệp khỏi quyết định"
                      disabled={busy}
                      onClick={() => setPaths((prev) => prev.filter((p) => p !== path))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 text-primary" strokeWidth={1.5} aria-hidden="true" />
                )}
                Tải bản đã ký
              </Button>
              <span className="text-xs text-muted-foreground">PDF/JPG/PNG/XLSX/DOCX, tối đa 10MB mỗi tệp.</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={PLAN_DOC_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) void handleFiles(files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            className="gap-1.5"
            disabled={invalid || busy}
            onClick={() =>
              recordM.mutate(
                { docNo, docDate, docPaths: paths },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {recordM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Stamp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            Ghi nhận phê duyệt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
