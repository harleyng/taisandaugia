import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useImportOwnerPostings } from "@/hooks/useOwnerPostingImport";
import { ownerPostingPath } from "@/lib/asset-posting/paths";
import {
  POSTING_IMPORT_MAX_ROWS,
  classifyPostingRows,
  downloadPostingIssues,
  downloadPostingTemplate,
  parsePostingFile,
  type ClassifiedPostingImport,
  type CreatedPosting,
  type PostingImportContext,
  type PostingImportIssue,
} from "@/lib/asset-posting/postingImport";
import { PostingImportPreview, PostingIssueList } from "./PostingImportPreview";

type Step =
  | { kind: "pick" }
  | { kind: "preview"; fileName: string; result: ClassifiedPostingImport }
  | { kind: "done"; created: CreatedPosting[]; issues: PostingImportIssue[] };

interface PostingImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: PostingImportContext["branches"];
  existing: PostingImportContext["existing"];
  /** Danh sách chi nhánh chưa tải xong — chưa cho chọn file (phân loại cần chi nhánh). */
  loading?: boolean;
}

/** "Nhập từ Excel": tải mẫu → chọn file → xem trước (dòng lỗi nêu lý do) → tạo hồ sơ nháp cho các dòng hợp lệ. */
export function PostingImportDialog({ open, onOpenChange, branches, existing, loading }: PostingImportDialogProps) {
  const { workspaceId, isScoped, branchScope } = useOwnerWorkspace();
  const importM = useImportOwnerPostings();
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ctx = useMemo<PostingImportContext>(
    () => ({ isWorkspace: !!workspaceId, branches, branchScope: isScoped ? branchScope : null, existing }),
    [workspaceId, branches, isScoped, branchScope, existing],
  );

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
      const parsed = await parsePostingFile(file);
      if (parsed.missingColumns.length) {
        setError(`File thiếu cột: ${parsed.missingColumns.join(", ")}. Hãy dùng file mẫu.`);
      } else if (!parsed.rows.length) {
        setError("File chưa có dòng dữ liệu nào.");
      } else {
        setStep({ kind: "preview", fileName: file.name, result: classifyPostingRows(parsed.rows, ctx) });
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
      onSuccess: ({ created, failures }) => setStep({ kind: "done", created, issues: [...result.invalid, ...failures] }),
    });
  };

  const tooMany = step.kind === "preview" && step.result.valid.length > POSTING_IMPORT_MAX_ROWS;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Nhập tài sản từ Excel</DialogTitle>
          <DialogDescription>
            {step.kind === "preview"
              ? step.fileName
              : "Mỗi dòng tạo một hồ sơ nháp. Sau đó bổ sung ảnh, giấy tờ cho từng hồ sơ để hoàn tất số hoá."}
          </DialogDescription>
        </DialogHeader>

        {step.kind === "pick" && (
          <div className="space-y-3">
            <label
              htmlFor="posting-import-file"
              className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center transition-colors hover:bg-muted/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!loading) void readFile(e.dataTransfer.files?.[0]);
              }}
            >
              <IconTile icon={FileSpreadsheet} size="lg" className={reading || loading ? "animate-pulse" : undefined} />
              <span className="text-sm font-medium text-foreground">
                {loading ? "Đang tải danh sách chi nhánh…" : reading ? "Đang đọc file…" : "Chọn hoặc kéo thả file .xlsx / .csv"}
              </span>
              <span className="text-xs text-muted-foreground">Tối đa {POSTING_IMPORT_MAX_ROWS} tài sản mỗi lần.</span>
            </label>
            <input
              ref={fileRef}
              id="posting-import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={reading || loading}
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="link" className="h-auto p-0" onClick={() => downloadPostingTemplate(!!workspaceId)}>
              Tải file mẫu
            </Button>
          </div>
        )}

        {step.kind === "preview" && (
          <div className="space-y-3">
            <PostingImportPreview result={step.result} />
            {tooMany && (
              <p className="text-sm text-destructive">
                File có hơn {POSTING_IMPORT_MAX_ROWS} dòng hợp lệ — hãy chia thành nhiều file.
              </p>
            )}
          </div>
        )}

        {step.kind === "done" && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Đã tạo <span className="font-semibold tabular-nums">{step.created.length}</span> hồ sơ nháp
              {step.issues.length ? (
                <>
                  {" · "}
                  <span className="font-semibold tabular-nums text-destructive">{step.issues.length}</span> dòng chưa nhập
                </>
              ) : null}
              .
            </p>
            {step.created.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">
                  Mở từng hồ sơ để bổ sung ảnh &amp; giấy tờ và hoàn tất số hoá.
                </p>
                <ul className="max-h-48 divide-y overflow-y-auto rounded-xl border text-sm">
                  {step.created.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{c.code}</span>
                      <Link
                        to={ownerPostingPath(c.id)}
                        className="min-w-0 truncate text-primary hover:underline"
                        onClick={() => close(false)}
                      >
                        {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <PostingIssueList issues={step.issues} title="Dòng chưa nhập" />
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
                <Button variant="outline" disabled={importM.isPending} onClick={() => downloadPostingIssues(step.result.invalid)}>
                  Tải danh sách lỗi
                </Button>
              )}
              <Button disabled={!step.result.valid.length || tooMany || importM.isPending} onClick={write}>
                {importM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tạo {step.result.valid.length} hồ sơ nháp
              </Button>
            </>
          )}
          {step.kind === "done" && (
            <>
              {step.issues.length > 0 && (
                <Button variant="outline" onClick={() => downloadPostingIssues(step.issues)}>
                  Tải danh sách dòng chưa nhập
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
