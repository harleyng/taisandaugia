import { useRef, useState } from "react";
import { Upload, Loader2, X, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "contract-documents";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB — khớp trần của bucket
const ACCEPT = "application/pdf,image/jpeg,image/png";

interface Props {
  /** Đường dẫn trong bucket, KHÔNG phải URL. */
  value: string | null;
  onChange: (path: string | null) => void;
  supplierId: string;
  /** Hợp đồng chưa lưu thì chưa có id — dùng khoá tạm để gom file. */
  contractId?: string | null;
}

/**
 * Bản scan hợp đồng.
 *
 * ⚠️ Bucket này PRIVATE (khác `partner-logos`): lưu ĐƯỜNG DẪN chứ không lưu URL,
 * và mở file bằng `createSignedUrl`. `getPublicUrl` sẽ trả về một link trông
 * hợp lệ nhưng luôn 400 — lỗi im lặng khó lần nhất ở đây.
 */
export function ContractDocUpload({ value, onChange, supplierId, contractId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);

  const fileName = value ? value.split("/").pop() : null;

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast.error("File vượt quá 10MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${supplierId}/${contractId ?? "tam"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      onChange(path);
      toast.success("Đã tải bản scan lên");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi tải file");
    } finally {
      setUploading(false);
    }
  };

  const openDoc = async () => {
    if (!value) return;
    setOpening(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(value, 60);
      if (error || !data) throw new Error(error?.message ?? "Không mở được file");
      window.open(data.signedUrl, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không mở được file");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value ? (
        <>
          <button
            type="button"
            onClick={openDoc}
            disabled={opening}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted max-w-[220px]"
          >
            {opening ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="truncate">{fileName}</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
          <Button
            type="button" variant="outline" size="sm" className="h-8"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Đổi file"}
          </Button>
          <Button
            type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button" variant="outline" size="sm" className="h-9 gap-1.5"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 text-primary" />
            )}
            Tải bản scan
          </Button>
          <span className="text-xs italic text-muted-foreground">
            (PDF/JPG/PNG, tối đa 10MB)
          </span>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
