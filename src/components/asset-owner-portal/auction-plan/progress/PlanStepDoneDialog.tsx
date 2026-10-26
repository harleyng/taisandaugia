import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { PLAN_DOC_ACCEPT, uploadPlanDoc } from "@/hooks/useAuctionPlanApproval";
import { useSavePlanStep } from "@/hooks/useAuctionPlanProgress";
import { planHealthToday } from "@/lib/auctionPlan/health";
import { planStepLabel } from "@/lib/auctionPlan/steps";
import type { AuctionPlan, AuctionPlanItemStep } from "@/lib/auctionPlan/types";

interface PlanStepDoneDialogProps {
  step: AuctionPlanItemStep | null;
  plan: AuctionPlan;
  onOpenChange: (open: boolean) => void;
}

const Star = () => <span className="text-destructive">*</span>;

/**
 * "Đánh dấu xong" một mốc: ngày hoàn thành (bắt buộc, không ở tương lai — guard
 * của DB cũng chặn), số / ngày văn bản và tệp đính kèm.
 *
 * Mốc đã do SÀN xác nhận thì hộp thoại nói rõ: ngày của sàn thắng, ngày tự khai
 * chỉ được ghi vào ghi chú (luật A4.4, trigger của DB thực thi).
 */
export function PlanStepDoneDialog({ step, plan, onOpenChange }: PlanStepDoneDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [doneOn, setDoneOn] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState("");
  const [note, setNote] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const saveM = useSavePlanStep(plan);
  const today = planHealthToday();

  useEffect(() => {
    if (!step) return;
    setDoneOn(step.done_on ?? today);
    setPlannedDate(step.planned_date ?? "");
    setDocNo(step.doc_no ?? "");
    setDocDate(step.doc_date ?? "");
    setNote(step.note ?? "");
    setUrls(step.evidence_urls ?? []);
  }, [step, today]);

  if (!step) return null;

  const busy = uploading || saveM.isPending;
  const invalid = !doneOn || doneOn > today;
  const platform = step.source === "platform" && !!step.done_on;

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const added: string[] = [];
      for (const file of Array.from(files)) added.push(await uploadPlanDoc(plan.workspace_id, plan.id, file));
      setUrls((prev) => [...prev, ...added]);
      toast.success(added.length > 1 ? `Đã tải ${added.length} tệp lên` : "Đã tải tệp lên");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được tệp lên.");
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    saveM.mutate(
      {
        stepId: step.id,
        values: {
          planned_date: plannedDate || null,
          done_on: doneOn,
          doc_no: docNo.trim() || null,
          doc_date: docDate || null,
          evidence_urls: urls,
          note: note.trim() || null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{planStepLabel(step.step)}</DialogTitle>
          <DialogDescription>
            {platform
              ? "Mốc này do dữ liệu trên sàn xác nhận. Ngày của sàn được giữ nguyên; ngày bạn khai sẽ được ghi vào ghi chú."
              : "Ghi nhận ngày hoàn thành, số văn bản và bản scan (nếu có)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="step-done-on" className="text-sm font-medium text-foreground">
                Ngày hoàn thành <Star />
              </label>
              <Input
                id="step-done-on"
                type="date"
                max={today}
                value={doneOn}
                onChange={(e) => setDoneOn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="step-planned-date" className="text-sm font-medium text-foreground">
                Ngày dự kiến
              </label>
              <Input
                id="step-planned-date"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="step-doc-no" className="text-sm font-medium text-foreground">
                Số văn bản
              </label>
              <Input id="step-doc-no" value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="123/QĐ-UBND" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="step-doc-date" className="text-sm font-medium text-foreground">
                Ngày văn bản
              </label>
              <Input id="step-doc-date" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Tệp đính kèm</p>
            {urls.length > 0 && (
              <ul className="space-y-1.5">
                {urls.map((path) => (
                  <li key={path} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{path.split("/").pop()}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Bỏ tệp"
                      onClick={() => setUrls((prev) => prev.filter((p) => p !== path))}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={PLAN_DOC_ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              )}
              Tải tệp lên
            </Button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="step-note" className="text-sm font-medium text-foreground">
              Ghi chú
            </label>
            <Textarea id="step-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button disabled={busy || invalid} onClick={submit}>
            {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Lưu mốc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
