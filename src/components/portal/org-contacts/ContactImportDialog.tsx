import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoBox } from "@/components/shared/InfoBox";
import { useImportOrgContacts } from "@/hooks/useOrgContacts";
import {
  classifyContacts,
  downloadContactIssues,
  downloadContactTemplate,
  parseContactFile,
  type ParsedContactRow,
} from "@/lib/orgContacts/contactImport";
import { cn } from "@/lib/utils";
import type { OrgContactImportResult, OrgContactListRow } from "@/types/org-contacts";

type Step = "upload" | "preview" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: OrgContactListRow[];
}

export function ContactImportDialog({ open, onOpenChange, existing }: Props) {
  const importer = useImportOrgContacts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ParsedContactRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<OrgContactImportResult | null>(null);

  const classified = useMemo(() => classifyContacts(rows, existing), [rows, existing]);
  const noConsent = classified.valid.filter((r) => !r.notifications_enabled).length;
  const noInterest = classified.valid.filter((r) => !r.categories.length && !r.provinces.length && r.price_min == null && r.price_max == null).length;
  const unknownCats = [...new Set(classified.valid.flatMap((r) => r.unknownCategories))];
  const issues = [...classified.invalid, ...classified.duplicates];

  const reset = () => {
    setStep("upload");
    setRows([]);
    setFileName(null);
    setParseError(null);
    setResult(null);
  };

  const close = () => {
    if (importer.isPending) return;
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    try {
      setRows(await parseContactFile(file));
      setStep("preview");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Không đọc được file.");
    }
  };

  const confirm = () =>
    importer.mutate(
      classified.valid.map(({ unknownCategories: _u, ...r }) => r),
      {
        onSuccess: (res) => {
          setResult(res);
          setStep("done");
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import khách hàng</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Tải file mẫu, điền danh bạ của tổ chức rồi tải lên."}
            {step === "preview" && fileName}
            {step === "done" && "Hoàn tất."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={downloadContactTemplate}>
              <Download className="h-4 w-4" />
              Tải file mẫu (.xlsx)
            </Button>
            <div
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Kéo thả hoặc chọn file</p>
              <p className="mt-1 text-xs text-muted-foreground">.xlsx, .csv — tối đa 2,000 dòng mỗi lần</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
            {parseError && <InfoBox variant="amber" className="text-sm">{parseError}</InfoBox>}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Sẽ thêm" value={classified.valid.length} tone="text-success" />
              <Stat label="Trùng" value={classified.duplicates.length} tone="text-warning" />
              <Stat label="Lỗi" value={classified.invalid.length} tone="text-destructive" />
            </div>
            {classified.valid.length > 2000 && (
              <InfoBox variant="amber">Mỗi lần import tối đa 2,000 dòng — hãy tách file.</InfoBox>
            )}
            {noConsent > 0 && (
              <InfoBox variant="amber" className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {noConsent} khách chưa ghi "có" ở cột đồng ý nhận tin — sẽ không xuất hiện trong danh sách gửi khi tiếp
                  thị phiên cho tới khi được đánh dấu đồng ý.
                </span>
              </InfoBox>
            )}
            {noInterest > 0 && (
              <p className="text-muted-foreground">{noInterest} khách chưa khai nhu cầu tài sản.</p>
            )}
            {unknownCats.length > 0 && (
              <p className="text-muted-foreground">
                Bỏ qua loại tài sản không nhận ra: {unknownCats.slice(0, 5).join(", ")}
                {unknownCats.length > 5 ? "…" : ""}
              </p>
            )}
            {issues.length > 0 && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => downloadContactIssues(issues)}>
                Tải danh sách {issues.length} dòng bị bỏ
              </Button>
            )}
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-2 py-4 text-center text-sm">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="font-medium text-foreground">Đã thêm {result.inserted} khách hàng.</p>
            {result.skipped.length > 0 && (
              <p className="text-muted-foreground">
                Server bỏ qua {result.skipped.length} dòng trùng hoặc không hợp lệ.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button variant="outline" onClick={reset} disabled={importer.isPending}>
              Chọn file khác
            </Button>
          )}
          {step === "preview" ? (
            <Button
              onClick={confirm}
              disabled={!classified.valid.length || classified.valid.length > 2000 || importer.isPending}
            >
              {importer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {classified.valid.length} khách
            </Button>
          ) : (
            <Button variant={step === "done" ? "default" : "outline"} onClick={close}>
              {step === "done" ? "Đóng" : "Huỷ"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className={cn("text-xl font-semibold", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
