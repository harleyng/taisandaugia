import { useRef } from "react";
import { Camera, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KYC_IMAGE_ACCEPT } from "@/lib/ekyc/uploadKycImage";
import { cn } from "@/lib/utils";
import { KycImageThumb } from "./KycImageThumb";

interface Props {
  label: string;
  required?: boolean;
  /** Đường dẫn đã tải lên (buyer-kyc). */
  path: string | null;
  /** Ảnh vừa chọn trên máy — hiện ngay, không chờ URL ký. */
  localPreview?: string | null;
  uploading?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  onFile: (file: File) => void;
}

/** Một ô ảnh giấy tờ: trống ⇒ khung nét đứt "Chụp hoặc chọn ảnh"; có ảnh ⇒ xem + "Chụp lại". */
export function IdImageSlot({ label, required, path, localPreview, uploading, disabled, error, hint, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = Boolean(path || localPreview);
  const pick = () => inputRef.current?.click();

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </p>

      <div className="relative aspect-[1.586] w-full">
        {hasImage ? (
          localPreview ? (
            <img src={localPreview} alt={label} className="h-full w-full rounded-lg border border-border object-cover" />
          ) : (
            <KycImageThumb path={path!} alt={label} className="h-full w-full" />
          )
        ) : (
          <button
            type="button"
            onClick={pick}
            disabled={disabled || uploading}
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/40 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-60",
              error ? "border-destructive" : "border-border",
            )}
          >
            <Camera className="h-6 w-6" />
            Chụp hoặc chọn ảnh
          </button>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      {hasImage && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={pick} disabled={disabled || uploading}>
          <RefreshCw className="h-3.5 w-3.5" />
          Chụp lại
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={KYC_IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cho phép chọn lại đúng tệp vừa chọn.
          e.target.value = "";
          if (file) onFile(file);
        }}
      />

      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
