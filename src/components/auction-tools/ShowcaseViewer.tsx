import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShowcaseKind } from "@/types/auctionTools";

/** Render showcase theo loại. tour_3d/video → iframe sandbox (mẫu DocumentPreview);
 *  image → ảnh; link → nút mở tab mới. */
export function ShowcaseViewer({
  kind,
  url,
  title,
}: {
  kind: ShowcaseKind;
  url: string;
  title: string;
}) {
  if (kind === "image") {
    return (
      <img src={url} alt={title} className="w-full rounded-xl object-contain" />
    );
  }

  if (kind === "link") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <Button variant="outline">
          <ExternalLink className="mr-2 h-4 w-4" />
          Mở {title}
        </Button>
      </a>
    );
  }

  // tour_3d | video
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
      <iframe
        src={url}
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
