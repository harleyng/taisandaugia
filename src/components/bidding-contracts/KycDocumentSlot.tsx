import { useRef, useState } from "react";
import { FileUp, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KycImageThumb } from "@/components/ekyc/KycImageThumb";
import { useAuth } from "@/contexts/AuthContext";
import { KYC_DOCUMENT_ACCEPT, uploadKycImage } from "@/lib/ekyc/uploadKycImage";

interface Props {
  label: string;
  required?: boolean;
  path: string | null;
  error?: string;
  disabled?: boolean;
  onChange: (path: string) => void;
  /** Mỗi tệp vừa tải — nơi gọi dọn tệp không dùng. */
  onUploaded?: (path: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

/** Ô tải tài liệu (ảnh hoặc PDF) lên buyer-kyc: ĐKKD, giấy uỷ quyền. */
export function KycDocumentSlot({ label, required, path, error, disabled, onChange, onUploaded, onBusyChange }: Props) {
  const { userId } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    onBusyChange?.(true);
    setUploadError(null);
    try {
      const p = await uploadKycImage(userId, file, "document");
      onUploaded?.(p);
      onChange(p);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Tải tệp lên không thành công.");
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  };

  const shown = uploadError ?? error;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      <div className="flex items-center gap-3">
        {path && <KycImageThumb path={path} alt={label} className="h-20 w-28 shrink-0" />}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : path ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          {path ? "Thay tệp" : "Tải tệp lên"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={KYC_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {shown ? (
        <p className="text-sm font-medium text-destructive">{shown}</p>
      ) : (
        <p className="text-xs text-muted-foreground">JPG, PNG hoặc PDF, tối đa 10 MB.</p>
      )}
    </div>
  );
}
