import { useState } from "react";
import { ArrowUpRight, Box, Rotate3d, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Model3dViewer } from "@/components/asset-3d/Model3dViewer";
import { VrTourViewer } from "@/components/vr-tour/VrTourViewer";
import type { SharedPosting } from "@/lib/postingShare/types";

type Viewer = "3d" | "vr" | null;

function MediaCard({
  poster,
  icon: Icon,
  title,
  note,
  onClick,
}: {
  poster: string | null;
  icon: LucideIcon;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-4 rounded-2xl border border-transparent bg-card py-2.5 pl-2.5 pr-[18px] text-left shadow-card transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_4px_18px_-4px_hsl(var(--primary)/0.25)]"
    >
      <span className="relative h-16 w-[88px] shrink-0 overflow-hidden rounded-xl bg-primary/10 sm:h-[84px] sm:w-[120px]">
        {poster && <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <span className="pointer-events-none absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden="true" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold text-foreground">{title}</b>
        <span className="text-[13px] text-muted-foreground">{note}</span>
      </span>
      <ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}

/**
 * Hai thẻ mở Model 3D / VR tour (trình xem sẵn có) — chỉ nội dung admin đã duyệt công khai.
 * VR tour không có ảnh poster riêng ⇒ dùng ảnh bìa hồ sơ.
 */
export function SharedMediaCards({ posting: p }: { posting: SharedPosting }) {
  const [open, setOpen] = useState<Viewer>(null);
  if (!p.model3d && !p.vrUrl) return null;
  const cover = p.imageUrls[0] ?? null;

  return (
    <>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] sm:gap-3">
        {p.model3d && (
          <MediaCard
            poster={p.model3d.posterUrl ?? cover}
            icon={Box}
            title="Xem model 3D"
            note="Xoay, phóng to để xem mặt tiền và khối nhà"
            onClick={() => setOpen("3d")}
          />
        )}
        {p.vrUrl && (
          <MediaCard
            poster={cover}
            icon={Rotate3d}
            title="Tham quan VR 360°"
            note="Đi quanh tài sản như đang đứng tại chỗ"
            onClick={() => setOpen("vr")}
          />
        )}
      </div>

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{open === "vr" ? "VR tour 360°" : "Model 3D"}</DialogTitle>
            <DialogDescription>
              {open === "vr"
                ? "Kéo để nhìn quanh, bấm vào điểm mũi tên để đi sang khu vực khác."
                : "Xoay, phóng to để xem bề mặt và chi tiết tài sản."}
            </DialogDescription>
          </DialogHeader>
          {open === "3d" && p.model3d && (
            <Model3dViewer
              modelUrl={p.model3d.url}
              format={p.model3d.format}
              posterUrl={p.model3d.posterUrl}
              title={p.title}
            />
          )}
          {open === "vr" && p.vrUrl && <VrTourViewer url={p.vrUrl} title={p.title} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
