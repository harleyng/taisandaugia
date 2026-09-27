import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ownerPostingPrintPath } from "@/lib/asset-posting/paths";

/** "Xuất PDF": mở bản in A4 của hồ sơ ở tab mới, tự bật hộp thoại in (Lưu thành PDF). */
export function ExportPostingPdfButton({ postingId }: { postingId: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => window.open(`${ownerPostingPrintPath(postingId)}?auto=1`, "_blank", "noopener")}
    >
      <FileDown className="h-3.5 w-3.5" />
      Xuất PDF
    </Button>
  );
}
