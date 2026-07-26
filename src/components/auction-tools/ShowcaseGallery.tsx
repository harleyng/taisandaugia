import { useState } from "react";
import { Lock, Box, Image as ImageIcon, Video, LinkIcon, Play } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ShowcaseViewer } from "./ShowcaseViewer";
import { ShowcaseUnlock } from "./ShowcaseUnlock";
import { usePublicShowcases } from "@/hooks/usePublicAuctionTools";
import type { PublicShowcase, ShowcaseKind } from "@/types/auctionTools";

const KIND_ICON: Record<ShowcaseKind, typeof Box> = {
  tour_3d: Box,
  image: ImageIcon,
  video: Video,
  link: LinkIcon,
};
const KIND_LABEL: Record<ShowcaseKind, string> = {
  tour_3d: "Tour 3D",
  image: "Hình ảnh",
  video: "Video",
  link: "Liên kết",
};

export function ShowcaseGallery({ providerId }: { providerId: string }) {
  const { data: showcases, isLoading } = usePublicShowcases(providerId);
  const [active, setActive] = useState<PublicShowcase | null>(null);
  // URL đã mở khoá cho showcase password trong phiên xem hiện tại.
  const [unlockedUrl, setUnlockedUrl] = useState<string | null>(null);

  const open = (s: PublicShowcase) => {
    setActive(s);
    setUnlockedUrl(s.is_locked ? null : s.url);
  };
  const close = () => { setActive(null); setUnlockedUrl(null); };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
      </div>
    );
  }

  if (!showcases || showcases.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có showcase nào.</p>;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {showcases.map((s) => {
          const Icon = KIND_ICON[s.kind];
          return (
            <button
              key={s.id}
              onClick={() => open(s)}
              className="group relative overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-video bg-muted">
                {s.thumbnail_url ? (
                  <img src={s.thumbnail_url} alt={s.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                    <Icon className="h-10 w-10 text-primary/50" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                    {s.is_locked ? <Lock className="h-5 w-5 text-amber-600" /> : <Play className="h-5 w-5 text-primary" />}
                  </span>
                </div>
                {s.is_locked && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Lock className="h-3 w-3" /> Bảo mật
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground">{KIND_LABEL[s.kind]}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
          </DialogHeader>
          {active && (
            unlockedUrl
              ? <ShowcaseViewer kind={active.kind} url={unlockedUrl} title={active.title} />
              : <ShowcaseUnlock showcaseId={active.id} onUnlocked={setUnlockedUrl} />
          )}
          {active?.description && (
            <p className="text-sm text-muted-foreground">{active.description}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
