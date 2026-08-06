import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx-js-style";
import { AlertCircle, Check, Download, FileText, Loader2, Search, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  classifyRows,
  parseFileRows,
  type ClassifiedImport,
} from "@/lib/marketing/importClassify";
import { ImportReport } from "./ImportReport";
import type { UserLabel } from "@/hooks/useUserLabels";
import { qk } from "@/lib/queryKeys";

type SearchRow = UserLabel & { notifications_enabled: boolean };

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([["Email *"], ["nguoinhan@example.com"]]);
  ws["!cols"] = [{ wch: 32 }];
  const header = ws["A1"] as XLSX.CellObject;
  header.s = {
    font: { bold: true, sz: 12, color: { rgb: "1F2937" } },
    fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
    alignment: { vertical: "center", horizontal: "left" },
    border: { bottom: { style: "medium", color: { rgb: "1F2937" } } },
  };
  const example = ws["A2"] as XLSX.CellObject;
  example.s = { font: { color: { rgb: "94A3B8" } } };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Danh sách");
  XLSX.writeFile(wb, "mau-import-email.xlsx");
}

/**
 * Tra danh sách email thuộc tài khoản CHƯA cho phép nhận (notifications_enabled
 * !== true) — nhất quán với bộ lọc opt-in của RPC gửi. Chia lô để chịu file lớn.
 */
async function fetchOptOut(emails: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("profiles")
      .select("email,notifications_enabled")
      .in("email", chunk);
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.notifications_enabled !== true && r.email) out.add(String(r.email).toLowerCase());
    }
  }
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Ids đã chọn — để hiển thị "Đã thêm" trong kết quả tìm kiếm. */
  selectedIds: string[];
  /** Email đã có trong danh sách (lowercase) — để phát hiện trùng khi import. */
  existingEmails: string[];
  onAddUser: (user: UserLabel) => void;
  onAddEmails: (emails: string[]) => void;
}

/** Thêm người nhận: 1 dialog gồm 2 tab — tìm & chọn người dùng / import file email. */
export function AddRecipientsDialog({
  open,
  onOpenChange,
  selectedIds,
  existingEmails,
  onAddUser,
  onAddEmails,
}: Props) {
  // ── Tab tìm & chọn ──
  const [q, setQ] = useState("");
  const term = q.trim().replace(/[,()%*]/g, " ").trim();
  const { data: results, isFetching } = useQuery<SearchRow[]>({
    queryKey: qk.profileSearch(term),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,name,notifications_enabled")
        .or(`email.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SearchRow[];
    },
    enabled: term.length >= 2,
  });

  // ── Tab import ──
  const [stage, setStage] = useState<"drop" | "report">("drop");
  const [fileName, setFileName] = useState<string | null>(null);
  const [res, setRes] = useState<ClassifiedImport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dọn trạng thái khi đóng dialog để lần mở sau bắt đầu sạch.
  useEffect(() => {
    if (open) return;
    setStage("drop");
    setFileName(null);
    setRes(null);
    setParseError(null);
    setIsClassifying(false);
    setQ("");
  }, [open]);

  const handleFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    setIsClassifying(true);
    try {
      const rows = await parseFileRows(file);
      // Lượt 1: lọc email ứng viên (hợp lệ + không trùng) để tra opt-in.
      const pass1 = classifyRows(rows, existingEmails);
      const optOut = await fetchOptOut(pass1.valid.map((r) => r.raw));
      // Lượt 2: phân loại đầy đủ, tách nhóm chưa cho phép nhận.
      setRes(classifyRows(rows, existingEmails, optOut));
      setStage("report");
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : "Lỗi không xác định");
      setStage("drop");
      setFileName(null);
    } finally {
      setIsClassifying(false);
    }
  };

  const confirmImport = () => {
    if (!res) return;
    onAddEmails(res.valid.map((r) => r.raw));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm người nhận</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="search" className="mt-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search">Tìm &amp; chọn</TabsTrigger>
            <TabsTrigger value="import">Import file</TabsTrigger>
          </TabsList>

          {/* Tìm & chọn người dùng */}
          <TabsContent value="search" className="mt-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nhập email hoặc tên…"
                className="h-9 pl-8"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              {term.length < 2 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nhập tối thiểu 2 ký tự để tìm.
                </p>
              ) : isFetching ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Đang tìm…</p>
              ) : !results || results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Không tìm thấy người dùng.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {results.map((u) => {
                    const optOut = !u.notifications_enabled;
                    const added = selectedIds.includes(u.id);
                    const disabled = optOut || added;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onAddUser({ id: u.id, email: u.email, name: u.name })}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "truncate text-sm",
                                optOut ? "text-muted-foreground" : "text-foreground",
                              )}
                            >
                              {u.email}
                            </p>
                            <p
                              className={cn(
                                "truncate text-xs",
                                optOut ? "text-warning" : "text-muted-foreground",
                              )}
                            >
                              {optOut ? "Chưa cho phép nhận email" : (u.name ?? "—")}
                            </p>
                          </div>
                          {optOut ? (
                            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-warning">
                              Không thể thêm
                            </span>
                          ) : added ? (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                              <Check className="h-3.5 w-3.5" /> Đã thêm
                            </span>
                          ) : (
                            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-primary">
                              + Thêm
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Bấm để thêm; có thể thêm nhiều người rồi bấm Xong. Người chưa cho phép nhận email
              không thể thêm.
            </p>
          </TabsContent>

          {/* Import file email */}
          <TabsContent value="import" className="mt-3 space-y-3">
            {stage === "report" && res ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {fileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStage("drop");
                      setRes(null);
                      setFileName(null);
                    }}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Chọn file khác
                  </button>
                </div>
                <ImportReport res={res} onConfirm={confirmImport} />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Tải file mẫu (một cột <strong>Email</strong>), điền danh sách rồi upload lại. Email
                  sai định dạng, trùng, hoặc thuộc tài khoản chưa cho phép nhận sẽ được liệt kê để
                  bạn kiểm tra trước khi thêm.
                </p>

                <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full gap-2">
                  <Download className="h-3.5 w-3.5" />
                  Tải file mẫu (.xlsx)
                </Button>

                <div
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                    isClassifying
                      ? "cursor-default border-border bg-muted/30"
                      : "cursor-pointer",
                    isDragging && !isClassifying
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40",
                  )}
                  onDragOver={(e) => {
                    if (isClassifying) return;
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (isClassifying) return;
                    const f = e.dataTransfer.files[0];
                    if (f) handleFile(f);
                  }}
                  onClick={() => {
                    if (!isClassifying) fileRef.current?.click();
                  }}
                >
                  {isClassifying ? (
                    <>
                      <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Đang xử lý danh sách…</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Kéo thả hoặc chọn file</p>
                      <p className="mt-1 text-xs text-muted-foreground">.xlsx, .csv</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />

                {parseError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.08] px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {parseError}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
