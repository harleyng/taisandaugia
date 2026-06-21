import { useRef, useState } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "article-images";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

async function uploadImage(file: File): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error("Ảnh vượt quá 5MB");

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `uploads/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Thumbnail variant (shows preview + remove) ──────────────────────────────

interface ThumbnailUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export function ThumbnailUpload({ value, onChange }: ThumbnailUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
      toast.success("Đã tải ảnh lên");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi tải ảnh");
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  if (value) {
    return (
      <div className="relative rounded-lg overflow-hidden aspect-video bg-muted">
        <img src={value} alt="Thumbnail" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors group flex items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
            Đổi ảnh
          </Button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleInputChange} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary disabled:opacity-60"
    >
      {uploading ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-xs">Đang tải lên...</span>
        </>
      ) : (
        <>
          <ImageIcon className="h-6 w-6" />
          <span className="text-xs font-medium">Chọn ảnh đại diện</span>
          <span className="text-[11px]">JPG, PNG, WebP — tối đa 5MB</span>
        </>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleInputChange} />
    </button>
  );
}

// ─── Inline toolbar variant (just returns a URL for Tiptap) ──────────────────

interface InlineImageUploadProps {
  onUploaded: (url: string) => void;
  children: React.ReactNode;
  title?: string;
}

export function InlineImageUpload({ onUploaded, children, title }: InlineImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi tải ảnh");
    } finally {
      setUploading(false);
    }
  };

  return (
    <button
      type="button"
      title={title}
      disabled={uploading}
      onMouseDown={(e) => {
        e.preventDefault();
        inputRef.current?.click();
      }}
      className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
    >
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleInputChange} />
    </button>
  );
}
