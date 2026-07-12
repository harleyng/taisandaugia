import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "partner-logos";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml";

async function uploadLogo(file: File): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error("Ảnh vượt quá 5MB");
  const ext = file.name.split(".").pop() ?? "png";
  const path = `uploads/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export function PartnerLogoUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      onChange(url);
      toast.success("Đã tải logo lên");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi tải ảnh");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="flex items-center gap-2">
          <img
            src={value}
            alt="Logo đối tác"
            className="h-14 max-w-[160px] rounded border border-border object-contain bg-muted p-1"
          />
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Đổi logo"}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onChange("")}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-primary" />}
          Upload logo
        </Button>
      )}

      {!value && (
        <span className="text-xs italic text-muted-foreground">(PNG/SVG nền trong suốt, tối đa 5MB)</span>
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
