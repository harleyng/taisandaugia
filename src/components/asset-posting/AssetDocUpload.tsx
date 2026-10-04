import { useRef } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStorageUpload } from "./useStorageUpload";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

interface AssetDocUploadProps {
  /** Mảng storage path (bucket private) đã tải lên. */
  value: string[];
  onChange: (paths: string[]) => void;
  /** Tiền tố folder con trong user folder, vd "ownership" | "legal". */
  prefix?: string;
  /** Bucket private đích (mặc định `asset-docs`, folder theo auth.uid()). */
  bucket?: string;
  /** MIME nhận — phải khớp allowed_mime_types của bucket. */
  accept?: string;
  /** Dòng gợi ý dưới nút tải. */
  hint?: string;
  /**
   * Thư mục gốc thay cho `{uid}`, xin NGAY TRƯỚC khi tải (vd id hồ sơ — wizard tự lưu
   * nháp để có id). Trả null ⇒ huỷ lượt tải.
   */
  resolveRoot?: () => Promise<string | null>;
  disabled?: boolean;
}

const fileNameFromPath = (path: string) => path.split("/").pop() ?? path;

/** Upload nhiều tài liệu vào bucket private (mặc định `asset-docs`, folder theo auth.uid()). */
export function AssetDocUpload({
  value,
  onChange,
  prefix = "docs",
  bucket = "asset-docs",
  accept = ACCEPT,
  hint = "PDF, JPG, PNG — tối đa 10MB mỗi file",
  resolveRoot,
  disabled,
}: AssetDocUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, upload } = useStorageUpload({
    bucket,
    maxSize: MAX_SIZE,
    folder: prefix,
    returns: "path",
    label: "tài liệu",
  });

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // FileList là đối tượng SỐNG của input: sao File ra trước rồi mới reset, không thì mất cả lượt.
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    let root: string | undefined;
    if (resolveRoot) {
      const r = await resolveRoot();
      if (!r) return;
      root = r;
    }
    const uploaded = await upload(files, { root });
    if (uploaded.length) {
      onChange([...value, ...uploaded]);
      toast.success(`Đã tải lên ${uploaded.length} tài liệu`);
    }
  };

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2.5">
      {value.map((path, idx) => (
        <div key={path} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{fileNameFromPath(path)}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeAt(idx)}
            disabled={disabled}
            aria-label="Bỏ tệp"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs"
          disabled={uploading || disabled}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Đang tải lên..." : "Tải tài liệu lên"}
        </Button>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>

      <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handleInputChange} />
    </div>
  );
}
