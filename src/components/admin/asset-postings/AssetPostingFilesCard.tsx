import { FileText, ExternalLink, ImageOff, PenLine } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AdminAssetPosting } from "@/hooks/useAdminAssetPostings";

// ⚠️ Ba mảng này KHÔNG cùng loại dữ liệu, dù tên cột đều là "*_urls":
//   image_urls           → public URL thật (bucket asset-media, public)
//   ownership_proof_urls → storage path   (bucket asset-docs, private)
//   doc_urls             → storage path   (bucket asset-docs, private)
// Giấy tờ phải mở qua signed URL, gắn thẳng vào <a href> sẽ ra 404.

const fileName = (path: string) => path.split("/").pop() ?? path;

async function openDoc(path: string) {
  const { data, error } = await supabase.storage.from("asset-docs").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast.error("Không thể mở file");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function DocRow({ path, tag }: { path: string; tag: string }) {
  return (
    <button
      type="button"
      onClick={() => openDoc(path)}
      className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-foreground">{fileName(path)}</span>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {tag}
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function AssetPostingFilesCard({ posting }: { posting: AdminAssetPosting }) {
  const proofs = posting.ownership_proof_urls ?? [];
  const extras = posting.doc_urls ?? [];
  const images = posting.image_urls ?? [];
  const videos = posting.video_urls ?? [];
  const declaration = posting.ownership_declaration;

  return (
    <div className="space-y-5">
      {declaration && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Bản cam kết quyền sở hữu</h3>
          {/* Nhóm máy móc / hàng hoá / đồ dùng không có giấy tờ đăng ký sở hữu —
              bản cam kết này LÀ căn cứ pháp lý duy nhất để duyệt. */}
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <PenLine className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-medium text-foreground">{declaration.name}</span>
              <span className="text-xs text-muted-foreground">đã ký điện tử</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(declaration.accepted_at), "HH:mm dd/MM/yyyy", { locale: vi })} · phiên bản{" "}
              {declaration.version}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Giấy tờ pháp lý
          <span className="ml-1.5 font-normal text-muted-foreground">({proofs.length + extras.length})</span>
        </h3>
        {proofs.length + extras.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có giấy tờ nào.</p>
        ) : (
          <div className="space-y-1.5">
            {proofs.map((p) => (
              <DocRow key={p} path={p} tag="Chứng minh sở hữu" />
            ))}
            {extras.map((p) => (
              <DocRow key={p} path={p} tag="Bổ sung" />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Ảnh tài sản
          <span className="ml-1.5 font-normal text-muted-foreground">({images.length})</span>
        </h3>
        {images.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ImageOff className="h-4 w-4" />
            Chưa có ảnh nào.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {images.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square overflow-hidden rounded-lg bg-muted"
              >
                <img src={url} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      {videos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Video tài sản
            <span className="ml-1.5 font-normal text-muted-foreground">({videos.length})</span>
          </h3>
          <div className="space-y-2.5">
            {videos.map((url) => (
              <video key={url} src={url} controls preload="metadata" className="w-full rounded-lg bg-black" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
