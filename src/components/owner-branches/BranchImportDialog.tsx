import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BranchInput } from "@/hooks/useWorkspaceBranches";

// ─── Template ─────────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  "Tên chi nhánh *",
  "Điện thoại",
  "Email",
  "Ghi chú",
  "Loại AMC (có/không)",
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ["Ví dụ: Chi nhánh Hà Nội", "0901234567", "hn@congty.vn", "Chi nhánh miền Bắc", "không"],
  ]);
  ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Chi nhánh");
  XLSX.writeFile(wb, "mau-import-chi-nhanh.xlsx");
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export interface ParsedBranchRow {
  display_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  is_amc: boolean;
  error?: string;
}

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[*\s]+/g, " ").trim();
}

function parseFile(file: File): Promise<ParsedBranchRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (raw.length < 2) { resolve([]); return; }

        const headers = (raw[0] as string[]).map(normalizeHeader);
        const idxName = headers.findIndex((h) => h.includes("tên") && h.includes("nhánh") || h === "tên chi nhánh *" || h === "tên chi nhánh");
        const idxPhone = headers.findIndex((h) => h.includes("điện thoại") || h === "phone");
        const idxEmail = headers.findIndex((h) => h.includes("email"));
        const idxNotes = headers.findIndex((h) => h.includes("ghi chú") || h === "notes");
        const idxAmc = headers.findIndex((h) => h.includes("amc"));

        const rows: ParsedBranchRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i] as string[];
          const name = idxName >= 0 ? String(row[idxName] ?? "").trim() : "";
          if (!name) continue;

          const amcRaw = idxAmc >= 0 ? String(row[idxAmc] ?? "").trim().toLowerCase() : "";
          const is_amc = amcRaw === "có" || amcRaw === "co" || amcRaw === "yes" || amcRaw === "true" || amcRaw === "1";

          rows.push({
            display_name: name,
            contact_phone: idxPhone >= 0 ? (String(row[idxPhone] ?? "").trim() || null) : null,
            contact_email: idxEmail >= 0 ? (String(row[idxEmail] ?? "").trim() || null) : null,
            notes: idxNotes >= 0 ? (String(row[idxNotes] ?? "").trim() || null) : null,
            is_amc,
          });
        }
        resolve(rows);
      } catch {
        reject(new Error("Không thể đọc file. Vui lòng dùng file .xlsx hoặc .csv."));
      }
    };
    reader.onerror = () => reject(new Error("Lỗi đọc file."));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (rows: BranchInput[]) => Promise<void>;
}

type Step = "upload" | "preview" | "done";

export const BranchImportDialog = ({ open, onOpenChange, onImport }: Props) => {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ParsedBranchRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (isImporting) return;
    onOpenChange(false);
    setTimeout(() => { setStep("upload"); setRows([]); setParseError(null); setFileName(null); }, 300);
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    try {
      const parsed = await parseFile(file);
      setRows(parsed);
      setStep("preview");
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Lỗi không xác định");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirm = async () => {
    setIsImporting(true);
    try {
      await onImport(rows);
      setStep("done");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import chi nhánh"}
            {step === "preview" && `Xem trước — ${rows.length} hàng hợp lệ`}
            {step === "done" && "Import thành công"}
          </DialogTitle>
        </DialogHeader>

        {/* STEP: Upload */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Tải file mẫu, điền thông tin chi nhánh, rồi upload lại.
            </p>

            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 w-full">
              <Download className="h-3.5 w-3.5" />
              Tải file mẫu (.xlsx)
            </Button>

            {/* Drop zone */}
            <div
              className={cn(
                "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">
                {fileName ? fileName : "Kéo thả hoặc chọn file"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .csv — tối đa 5 MB</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />

            {parseError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {parseError}
              </div>
            )}
          </div>
        )}

        {/* STEP: Preview */}
        {step === "preview" && (
          <div className="space-y-3 py-2">
            {rows.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-700">
                Không tìm thấy hàng hợp lệ nào. Vui lòng kiểm tra lại file và đảm bảo cột "Tên chi nhánh" có giá trị.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tên chi nhánh</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">Điện thoại</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground hidden sm:table-cell">Email</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">AMC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                          <td className="px-3 py-1.5 font-medium text-foreground">{r.display_name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground hidden sm:table-cell">{r.contact_phone ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground hidden sm:table-cell">{r.contact_email ?? "—"}</td>
                          <td className="px-3 py-1.5">
                            {r.is_amc ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">AMC</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sẽ thêm <strong>{rows.length}</strong> chi nhánh vào workspace.
                </p>
              </>
            )}

            <button
              onClick={() => { setStep("upload"); setRows([]); setFileName(null); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Chọn file khác
            </button>
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium text-foreground">Đã import {rows.length} chi nhánh thành công.</p>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Huỷ</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isImporting}>Huỷ</Button>
              <Button
                onClick={handleConfirm}
                disabled={rows.length === 0 || isImporting}
              >
                {isImporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Import {rows.length > 0 ? `${rows.length} chi nhánh` : ""}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={handleClose}>Đóng</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

