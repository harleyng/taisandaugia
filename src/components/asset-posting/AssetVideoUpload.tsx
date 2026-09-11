import { useRef } from "react";
import { Loader2, Video, X } from "lucide-react";
import { MAX_VIDEO_SIZE, MAX_VIDEOS, VIDEO_MIME } from "@/constants/asset-posting-rules";
import { useStorageUpload } from "./useStorageUpload";

interface AssetVideoUploadProps {
  /** Mảng public URL video đã tải lên (tối đa MAX_VIDEOS). */
  value: string[];
  onChange: (urls: string[]) => void;
}

/**
 * Upload video tài sản (tuỳ chọn) vào bucket public `asset-media`.
 *
 * Tách riêng khỏi AssetMediaUpload để giữ bất biến `image_urls[0]` = ảnh bìa:
 * gộp chung một mảng thì phần tử đầu có thể là video, và mọi chỗ đọc ảnh bìa
 * sau này phải đổi từ "phần tử đầu" sang "phần tử đầu có kind là ảnh".
 *
 * Path `${uid}/video/${uuid}.ext` — 4 policy sẵn có của bucket vẫn khớp vì
 * (storage.foldername(name))[1] vẫn là auth.uid().
 */
export function AssetVideoUpload({ value, onChange }: AssetVideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, upload } = useStorageUpload({
    bucket: "asset-media",
    maxSize: MAX_VIDEO_SIZE,
    folder: "video",
    returns: "url",
    label: "video",
  });

  const full = value.length >= MAX_VIDEOS;

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Xem chú thích ở AssetMediaUpload: phải sao File ra trước khi reset input.
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const uploaded = await upload(files.slice(0, MAX_VIDEOS - value.length));
    if (uploaded.length) onChange([...value, ...uploaded]);
  };

  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2.5">
      {value.map((url, idx) => (
        <div key={url} className="relative rounded-xl overflow-hidden bg-muted">
          {/* preload="metadata": không kéo cả tệp lúc mount, chỉ lấy khung đầu + thời lượng. */}
          <video src={url} controls preload="metadata" className="w-full max-h-64 bg-black" />
          <button
            type="button"
            onClick={() => removeAt(idx)}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            aria-label="Xoá video"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {!full && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1.5 py-6 text-muted-foreground hover:text-primary disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />}
          <span className="text-xs font-medium">{uploading ? "Đang tải..." : "Thêm video"}</span>
        </button>
      )}

      <p className="text-[11px] text-muted-foreground">
        MP4 hoặc WebM — tối đa 10MB, {MAX_VIDEOS} video. Không nhận .mov từ iPhone (trình duyệt không phát được).
      </p>
      <input ref={inputRef} type="file" accept={VIDEO_MIME} className="hidden" onChange={handleInputChange} />
    </div>
  );
}
