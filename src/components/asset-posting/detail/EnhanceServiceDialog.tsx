import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PostingModel3dCard } from "@/components/asset-3d/PostingModel3dCard";
import { PostingVrTourCard } from "@/components/vr-tour/PostingVrTourCard";
import type { AssetPosting } from "@/types/asset-posting";

/** Thẩm định giá / giám định có tab riêng trên trang hồ sơ — không mở ở đây. */
export type EnhanceKind = "3d" | "vr";

const COPY: Record<EnhanceKind, { title: string; description: string }> = {
  "3d": { title: "Model 3D", description: "Quét 3D qua đối tác; model gắn vào hồ sơ và công khai khi hồ sơ được duyệt." },
  vr: { title: "VR tour", description: "Tham quan 360° do đối tác thực hiện — đặt dịch vụ, thanh toán và theo dõi đơn." },
};

interface EnhanceServiceDialogProps {
  kind: EnhanceKind | null;
  onClose: () => void;
  posting: AssetPosting;
  /** Hồ sơ đã kết thúc ⇒ chỉ xem, không đặt đơn mới. */
  locked: boolean;
}

/**
 * Một dịch vụ tăng sức hút mở trong dialog — bên trong là ĐÚNG thẻ đầy đủ đang dùng ở
 * wizard / admin (đặt đơn, thanh toán, theo dõi), không viết lại luồng nào.
 */
export function EnhanceServiceDialog({ kind, onClose, posting: p, locked }: EnhanceServiceDialogProps) {
  return (
    <Dialog open={kind !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        {kind && (
          <>
            <DialogHeader>
              <DialogTitle>{COPY[kind].title}</DialogTitle>
              <DialogDescription>{COPY[kind].description}</DialogDescription>
            </DialogHeader>
            {kind === "3d" && (
              <PostingModel3dCard
                postingId={p.id}
                title={p.title}
                reviewStatus={p.review_status}
                mode="owner"
                locked={locked}
                workspaceId={p.workspace_id}
              />
            )}
            {kind === "vr" && (
              <PostingVrTourCard
                postingId={p.id}
                title={p.title}
                reviewStatus={p.review_status}
                mode="owner"
                locked={locked}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
