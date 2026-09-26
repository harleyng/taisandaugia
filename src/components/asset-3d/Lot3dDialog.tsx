import { ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VrTourViewer } from "@/components/vr-tour/VrTourViewer";
import type { Lot3dModel } from "@/types/asset3d";
import { Model3dViewer } from "./Model3dViewer";

export type LotMediaTab = "anh" | "3d" | "vr";

interface Lot3dDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotNo: number;
  title: string;
  imageUrl: string | null;
  /** Model 3D đã công khai (BR-3D-03) — không có thì ẩn tab 3D. */
  model?: Lot3dModel | null;
  /** Link VR tour đã gắn lô (BR-VR-02) — không có thì ẩn tab VR. */
  vrUrl?: string | null;
  defaultTab?: LotMediaTab;
}

/** Xem lô trên trang phiên: tab Ảnh / 3D / VR. Chỉ nhận nội dung đã được admin duyệt công khai. */
export function Lot3dDialog({ open, onOpenChange, lotNo, title, imageUrl, model, vrUrl, defaultTab }: Lot3dDialogProps) {
  const initial: LotMediaTab = defaultTab ?? (model ? "3d" : vrUrl ? "vr" : "anh");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Lô {lotNo} · {title}
          </DialogTitle>
          <DialogDescription>
            {initial === "vr"
              ? "Kéo để nhìn quanh, bấm vào điểm mũi tên để đi sang khu vực khác."
              : "Xoay, phóng to để xem bề mặt và chi tiết tài sản."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initial}>
          <TabsList>
            <TabsTrigger value="anh">Ảnh</TabsTrigger>
            {model && <TabsTrigger value="3d">3D</TabsTrigger>}
            {vrUrl && <TabsTrigger value="vr">VR</TabsTrigger>}
          </TabsList>
          <TabsContent value="anh">
            <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-muted">
              {imageUrl ? (
                <img src={imageUrl} alt={title} className="h-full w-full object-contain" />
              ) : (
                <ImageOff className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
          </TabsContent>
          {model && (
            <TabsContent value="3d">
              <Model3dViewer modelUrl={model.model_url} format={model.format} posterUrl={model.poster_url} title={title} />
            </TabsContent>
          )}
          {vrUrl && (
            <TabsContent value="vr">
              <VrTourViewer url={vrUrl} title={title} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
