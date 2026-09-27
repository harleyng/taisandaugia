import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PostingMediaDialogProps {
  images: string[];
  videos: string[];
  /** Ô được bấm: < images.length là ảnh, còn lại là khối video; null = đóng. */
  focusIndex: number | null;
  onClose: () => void;
}

/** Toàn bộ ảnh + video của hồ sơ; mở ra cuộn thẳng tới ô vừa bấm. */
export function PostingMediaDialog({ images, videos, focusIndex, onClose }: PostingMediaDialogProps) {
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (focusIndex === null) return;
    // Đợi nội dung dialog gắn vào DOM rồi mới cuộn.
    const t = window.setTimeout(() => refs.current[focusIndex]?.scrollIntoView({ block: "start" }), 50);
    return () => window.clearTimeout(t);
  }, [focusIndex]);

  return (
    <Dialog open={focusIndex !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hình ảnh & video</DialogTitle>
          <DialogDescription>
            {images.length} ảnh{videos.length ? ` · ${videos.length} video` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {images.map((url, i) => (
            <img
              key={url}
              ref={(el) => {
                refs.current[i] = el;
              }}
              src={url}
              alt={`Ảnh ${i + 1}`}
              className="w-full rounded-lg bg-muted object-contain"
            />
          ))}
          {videos.length > 0 && (
            <div
              ref={(el) => {
                refs.current[images.length] = el;
              }}
              className="space-y-3"
            >
              {videos.map((url) => (
                <video key={url} src={url} controls preload="metadata" className="w-full rounded-lg bg-black" />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
