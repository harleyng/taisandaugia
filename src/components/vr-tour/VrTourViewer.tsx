import { ExternalLink, Glasses } from "lucide-react";
import { vrEmbedSrc, vrOpensInNewTab } from "@/lib/vrTour/embed";

interface VrTourViewerProps {
  url: string;
  title: string;
  className?: string;
}

/**
 * Nhúng VR tour của đối tác bằng iframe sandbox (cùng thuộc tính với nhánh embed của
 * Model3dViewer / ShowcaseViewer). Link chỉ đến từ admin (https, kiểm ở DB) và chỉ
 * công khai sau khi admin duyệt; nếu trình xem của đối tác chặn nhúng thì còn nút mở
 * tab mới bên dưới. Host đã biết chặn nhúng (lib/vrTour/embed) ⇒ thẻ mở tab mới luôn;
 * tour tự host (public/vr/) nạp theo origin đang chạy.
 */
export function VrTourViewer({ url, title, className }: VrTourViewerProps) {
  if (vrOpensInNewTab(url)) {
    return (
      <div className={className}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/90 to-primary p-6 text-center text-primary-foreground"
        >
          <Glasses className="h-12 w-12 transition-transform group-hover:scale-110" strokeWidth={1.5} />
          <span className="text-lg font-semibold">{title}</span>
          <span className="max-w-sm text-sm text-primary-foreground/80">
            Tham quan 3D / VR tương tác — mở trong tab mới, hỗ trợ kính VR (WebXR).
          </span>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-background px-4 py-2 text-sm font-semibold text-primary shadow">
            Mở VR tour <ExternalLink className="h-4 w-4" />
          </span>
        </a>
      </div>
    );
  }

  const src = vrEmbedSrc(url, window.location.origin);

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted">
        <iframe
          src={src}
          title={`VR tour — ${title}`}
          className="h-full w-full"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope; magnetometer; vr"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        Mở VR tour toàn màn hình <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
