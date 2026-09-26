import { createElement, useCallback, useEffect, useState } from "react";
import { Box, ExternalLink, Loader2 } from "lucide-react";
import type { Asset3dFormat } from "@/types/asset3d";

interface Model3dViewerProps {
  modelUrl: string;
  format: Asset3dFormat | string | null;
  posterUrl?: string | null;
  title: string;
  className?: string;
}

// Nạp web component MỘT lần cho cả app; import động để three.js (~1 MB) không vào
// bundle chính — chỉ tải khi có người thật sự mở model.
let viewerModule: Promise<unknown> | null = null;
const loadViewer = () => (viewerModule ??= import("@google/model-viewer"));

/**
 * Hiển thị model 3D theo định dạng đối tác trả về:
 *  - glb   → <model-viewer> (xoay/zoom, AR trên điện thoại)
 *  - embed → iframe sandbox trình xem của đối tác (mẫu ShowcaseViewer)
 *  - usdz  → chỉ iOS mở được (AR Quick Look) ⇒ ảnh poster + liên kết mở
 */
export function Model3dViewer({ modelUrl, format, posterUrl, title, className }: Model3dViewerProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // React 18 không gắn listener cho sự kiện của custom element (và "error" không nổi
  // bọt) ⇒ gắn tay qua ref callback.
  const viewerRef = useCallback((el: HTMLElement | null) => {
    el?.addEventListener("error", () => setFailed(true), { once: true });
  }, []);
  const frame = `relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted ${className ?? ""}`;

  useEffect(() => {
    if (format !== "glb") return;
    let alive = true;
    loadViewer()
      .then(() => alive && setReady(true))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [format]);

  if (format === "embed") {
    return (
      <div className={frame}>
        <iframe
          src={modelUrl}
          title={title}
          className="h-full w-full"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope; magnetometer"
          allowFullScreen
        />
      </div>
    );
  }

  if (format === "usdz" || failed) {
    return (
      <div className={`${frame} flex flex-col items-center justify-center gap-3 p-4 text-center`}>
        {posterUrl ? (
          <img src={posterUrl} alt={title} className="absolute inset-0 h-full w-full object-contain opacity-40" />
        ) : (
          <Box className="h-10 w-10 text-muted-foreground" />
        )}
        <p className="relative text-sm text-muted-foreground">
          {failed ? "Trình duyệt không hiển thị được model 3D." : "Model định dạng USDZ — mở bằng iPhone/iPad để xem."}
        </p>
        <a
          href={modelUrl}
          rel={format === "usdz" ? "ar" : "noreferrer"}
          target="_blank"
          className="relative inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          Mở model <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className={frame}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải model 3D…
        </div>
      )}
      {ready &&
        // Custom element: dùng createElement để khỏi khai báo JSX toàn cục. Thuộc tính
        // boolean của web component truyền chuỗi rỗng.
        createElement("model-viewer", {
          src: modelUrl,
          poster: posterUrl ?? undefined,
          alt: `Model 3D — ${title}`,
          "camera-controls": "",
          "auto-rotate": "",
          ar: "",
          "ar-modes": "webxr scene-viewer quick-look",
          "shadow-intensity": "1",
          "touch-action": "pan-y",
          style: { width: "100%", height: "100%", backgroundColor: "transparent" },
          ref: viewerRef,
        })}
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
        Kéo để xoay · cuộn/chụm để phóng to
      </span>
    </div>
  );
}
