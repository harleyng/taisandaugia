import { useState } from "react";
import { Monitor, Smartphone, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  desktopUrl?: string | null;
  mobileUrl?: string | null;
}

/** Khung "Xem trước" có toggle Desktop / Mobile giống ảnh tham khảo. */
export function BannerPreview({ desktopUrl, mobileUrl }: Props) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const url = device === "desktop" ? desktopUrl : mobileUrl;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Xem trước</h3>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={cn("p-1.5 rounded-md transition-colors", device === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={cn("p-1.5 rounded-md transition-colors", device === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4">
        {/* Fake browser frame */}
        <div className="rounded-lg bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/60">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>
          <div className={cn("flex items-center justify-center p-4", device === "mobile" && "px-16")}>
            {url ? (
              <img src={url} alt="Xem trước banner" className="max-w-full max-h-64 rounded object-contain" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs">Chưa có ảnh {device === "desktop" ? "Desktop" : "Mobile"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
