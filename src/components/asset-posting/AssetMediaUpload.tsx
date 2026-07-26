import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const BUCKET = "asset-media";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/jpeg,image/png,image/webp";

interface AssetMediaUploadProps {
  /** Mảng public URL ảnh đã tải lên. */
  value: string[];
  onChange: (urls: string[]) => void;
}

/** Upload nhiều ảnh vào bucket public `asset-media`, folder theo auth.uid(). */
export function AssetMediaUpload({ value, onChange }: AssetMediaUploadProps) {
  const { userId } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList) => {
    if (!userId) {
      toast.error("Bạn cần đăng nhập để tải ảnh.");
      return;
    }
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: vượt quá 10MB`);
        continue;
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) {
        toast.error(`Lỗi tải ${file.name}: ${error.message}`);
        continue;
      }
      uploaded.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }
    if (uploaded.length) onChange([...value, ...uploaded]);
    setUploading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = "";
  };

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  // Kéo-thả sắp xếp: ảnh đầu mảng = ảnh bìa.
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= value.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const onDrop = (e: React.DragEvent, to: number) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isNaN(from)) move(from, to);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {value.map((url, idx) => (
          <div
            key={url}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, idx)}
            className="relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-move"
          >
            <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
            {idx === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-primary/90 px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">
                Ảnh bìa
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(idx)}
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-[10px] font-medium">{uploading ? "Đang tải..." : "Thêm ảnh"}</span>
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        JPG, PNG, WebP — tối đa 10MB mỗi ảnh. Kéo-thả để sắp xếp; ảnh đầu là ảnh bìa. Ảnh là tùy chọn.
      </p>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={handleInputChange} />
    </div>
  );
}
