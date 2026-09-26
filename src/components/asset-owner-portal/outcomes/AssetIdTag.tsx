import { cn } from "@/lib/utils";
import { shortAssetId } from "@/lib/ownerAssetId";

interface AssetIdTagProps {
  listingId: string;
  className?: string;
}

/** "Mã 3F9A12BC" — mã tài sản trên sàn, dùng để ghi vào file Excel nhập kết quả. */
export function AssetIdTag({ listingId, className }: AssetIdTagProps) {
  return (
    <span
      className={cn("inline-flex items-baseline gap-1 text-[11px] text-muted-foreground", className)}
      title="Mã tài sản — ghi vào cột «Mã tài sản» khi nhập kết quả từ Excel"
    >
      Mã
      <span className="font-mono tracking-wide text-foreground/80">{shortAssetId(listingId)}</span>
    </span>
  );
}
