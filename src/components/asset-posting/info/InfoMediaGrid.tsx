import { useRef, useState } from "react";
import { Camera, Loader2, Play, Video, X } from "lucide-react";
import { IMAGE_MIME, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_VIDEOS, VIDEO_MIME } from "@/constants/asset-posting-rules";
import { useStorageUpload } from "../useStorageUpload";

interface InfoMediaGridProps {
  images: string[];
  videos: string[];
  onImages: (urls: string[]) => void;
  onVideos: (urls: string[]) => void;
  /** Thiếu ảnh bắt buộc sau khi đã bấm "Tiếp tục" ⇒ viền đỏ ô thả tệp. */
  bad?: boolean;
}

const TILE = "relative aspect-[4/3] overflow-hidden rounded-[10px] border border-border";

/**
 * Ảnh & video chung một lưới (thiết kế v3) — ảnh đầu là ảnh bìa, chiếm 2×2.
 *
 * Vẫn là HAI mảng riêng (image_urls / video_urls) để giữ bất biến image_urls[0]
 * = ảnh bìa; chỉ phần hiển thị là gộp. Tệp lên bucket public `asset-media`
 * (video ở thư mục con `video/`) qua useStorageUpload như uploader cũ.
 */
export function InfoMediaGrid({ images, videos, onImages, onVideos, bad }: InfoMediaGridProps) {
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const img = useStorageUpload({ bucket: "asset-media", maxSize: MAX_IMAGE_SIZE, returns: "url", label: "ảnh" });
  const vid = useStorageUpload({
    bucket: "asset-media",
    maxSize: MAX_VIDEO_SIZE,
    folder: "video",
    returns: "url",
    label: "video",
  });
  const videoFull = videos.length >= MAX_VIDEOS;

  const addImages = async (files: File[]) => {
    if (!files.length) return;
    const up = await img.upload(files);
    if (up.length) onImages([...images, ...up]);
  };
  const addVideos = async (files: File[]) => {
    const room = MAX_VIDEOS - videos.length;
    if (!files.length || room <= 0) return;
    const up = await vid.upload(files.slice(0, room));
    if (up.length) onVideos([...videos, ...up]);
  };

  // Sao mảng File RA TRƯỚC rồi mới reset input — FileList là đối tượng sống.
  const fromInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    return files;
  };

  // Thả tệp từ máy: tách ảnh / video theo MIME, bỏ qua loại khác.
  const dropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (!files.length) return;
    void addImages(files.filter((f) => IMAGE_MIME.split(",").includes(f.type)));
    void addVideos(files.filter((f) => VIDEO_MIME.split(",").includes(f.type)));
  };

  // Kéo-thả sắp xếp ảnh (dữ liệu là chỉ số trong mảng ảnh).
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= images.length) return;
    const next = [...images];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onImages(next);
  };

  const inputs = (
    <>
      <input ref={imgInput} type="file" accept={IMAGE_MIME} multiple className="hidden" onChange={(e) => void addImages(fromInput(e))} />
      <input ref={vidInput} type="file" accept={VIDEO_MIME} className="hidden" onChange={(e) => void addVideos(fromInput(e))} />
    </>
  );

  if (!images.length && !videos.length) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={dropFiles}
        className={`flex w-full flex-col items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed px-4 py-[22px] text-center transition ${
          bad
            ? "border-destructive bg-destructive/[0.03]"
            : dragOver
              ? "border-primary bg-primary/5"
              : "border-input bg-muted/30 hover:border-primary hover:bg-primary/5"
        }`}
      >
        {img.uploading || vid.uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <Camera className="h-6 w-6 text-primary" />
        )}
        <span className="text-sm font-semibold text-foreground">Tải ảnh, video lên</span>
        <span className="text-[12.5px] text-muted-foreground">Ảnh JPG, PNG, WebP · Video MP4, WebM · tối đa 10MB mỗi tệp</span>
        <div className="mt-2 flex gap-2">
          <DropButton onClick={() => imgInput.current?.click()} disabled={img.uploading}>
            <Camera className="h-3.5 w-3.5" /> Chọn ảnh
          </DropButton>
          <DropButton onClick={() => vidInput.current?.click()} disabled={vid.uploading}>
            <Video className="h-3.5 w-3.5" /> Chọn video
          </DropButton>
        </div>
        {inputs}
      </div>
    );
  }

  return (
    <>
      <div
        className="grid grid-cols-3 gap-2.5 sm:grid-cols-4"
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={(e) => e.dataTransfer.files?.length && dropFiles(e)}
      >
        {images.map((url, i) => (
          <div
            key={url}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (e.dataTransfer.files?.length) return;
              e.preventDefault();
              e.stopPropagation();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from)) move(from, i);
            }}
            className={`group ${TILE} cursor-move bg-muted ${i === 0 ? "col-span-2 row-span-2 aspect-auto" : ""}`}
          >
            <img src={url} alt={`Ảnh ${i + 1}`} className="pointer-events-none h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-[5px] bg-foreground px-[7px] py-0.5 text-[11px] font-bold text-background">
                Ảnh bìa
              </span>
            )}
            <RemoveButton label="Xoá ảnh" onClick={() => onImages(images.filter((_, k) => k !== i))} />
          </div>
        ))}
        {videos.map((url, i) => (
          <div key={url} className={`group ${TILE} border-foreground/80 bg-foreground/90`}>
            <video src={url} preload="metadata" muted className="h-full w-full object-cover opacity-70" />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label="Xem video"
              className="absolute inset-0 m-auto grid h-[34px] w-[34px] place-items-center rounded-full bg-card/95 text-foreground"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </a>
            <RemoveButton label="Xoá video" onClick={() => onVideos(videos.filter((_, k) => k !== i))} />
          </div>
        ))}
        <AddTile onClick={() => imgInput.current?.click()} busy={img.uploading} icon={<Camera className="h-[17px] w-[17px]" />}>
          Thêm ảnh
        </AddTile>
        {!videoFull && (
          <AddTile onClick={() => vidInput.current?.click()} busy={vid.uploading} icon={<Video className="h-[17px] w-[17px]" />}>
            Thêm video
          </AddTile>
        )}
      </div>
      <div className="mt-2 text-[12.5px] text-muted-foreground">Kéo-thả để sắp xếp; ảnh đầu là ảnh bìa.</div>
      {inputs}
    </>
  );
}

function DropButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[13px] font-semibold text-muted-foreground transition hover:border-input hover:text-foreground disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function AddTile({
  onClick,
  busy,
  icon,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-input bg-muted/30 text-[12.5px] font-semibold text-primary transition hover:border-primary hover:bg-primary/5 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-[17px] w-[17px] animate-spin" /> : icon}
      {busy ? "Đang tải…" : children}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-foreground/60 text-background opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
    >
      <X className="h-[13px] w-[13px]" />
    </button>
  );
}
