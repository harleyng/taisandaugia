import { ExternalLink } from "lucide-react";

interface VrTourViewerProps {
  url: string;
  title: string;
  className?: string;
}

/**
 * Nhúng VR tour của đối tác bằng iframe sandbox (cùng thuộc tính với nhánh embed của
 * Model3dViewer / ShowcaseViewer). Link chỉ đến từ admin (https, kiểm ở DB) và chỉ
 * công khai sau khi admin duyệt; nếu trình xem của đối tác chặn nhúng thì còn nút mở
 * tab mới bên dưới.
 */
export function VrTourViewer({ url, title, className }: VrTourViewerProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted">
        <iframe
          src={url}
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
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        Mở VR tour toàn màn hình <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
