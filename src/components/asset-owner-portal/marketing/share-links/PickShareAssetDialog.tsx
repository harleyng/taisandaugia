import { FileText, Loader2, Store } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useShareableAssets, type ShareableAsset } from "@/hooks/useShareLinks";

interface PickShareAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (asset: ShareableAsset) => void;
}

function AssetGroup({ heading, items, onPick }: { heading: string; items: ShareableAsset[]; onPick: (a: ShareableAsset) => void }) {
  if (items.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {items.map((a) => {
        const Icon = a.kind === "posting" ? FileText : Store;
        return (
          <CommandItem key={a.key} value={`${a.title} ${a.code ?? ""} ${a.branchName ?? ""} ${a.key}`} onSelect={() => onPick(a)}>
            <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{a.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[a.code, a.branchName, a.listingStatus === "SOLD_RENTED" ? "Đã bán" : null].filter(Boolean).join(" · ") || " "}
              </span>
            </span>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

/**
 * Bước 1 của "Tạo link" từ trang tổng hợp: chọn hồ sơ số hoá đã duyệt hoặc tin trên sàn Trạm
 * đã nhận (trong phạm vi chi nhánh được tạo link). Bước 2 là form link (ShareLinkDialog).
 */
export function PickShareAssetDialog({ open, onOpenChange, onPick }: PickShareAssetDialogProps) {
  const { canIn, can } = useOwnerWorkspace();
  const { assets, isLoading, isError } = useShareableAssets(open);
  const allowed = assets.filter((a) =>
    a.kind === "posting"
      ? canIn("so-hoa", "share", a.branchId) || canIn("truyen-thong", "create", a.branchId)
      : canIn("truyen-thong", "create", a.branchId),
  );
  const postings = allowed.filter((a) => a.kind === "posting");
  const listings = allowed.filter((a) => a.kind === "listing");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Tạo link Hồ sơ online</DialogTitle>
          <DialogDescription>Chọn tài sản cần gửi khách. Hồ sơ số hoá phải được sàn duyệt trước.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
          </div>
        ) : isError ? (
          <p className="px-5 pb-5 text-sm text-destructive">Không tải được danh sách tài sản. Đóng và mở lại để thử lại.</p>
        ) : (
          <Command className="rounded-none border-t border-border">
            <CommandInput placeholder="Tìm theo tên, mã hồ sơ, chi nhánh" />
            <CommandList className="max-h-[360px]">
              <CommandEmpty>
                {allowed.length === 0
                  ? can("truyen-thong", "create") || can("so-hoa", "share")
                    ? "Chưa có hồ sơ đã duyệt hay tin trên sàn nào trong phạm vi của bạn."
                    : "Vai trò của bạn chưa có quyền tạo link."
                  : "Không có tài sản nào khớp."}
              </CommandEmpty>
              <AssetGroup heading="Hồ sơ số hoá" items={postings} onPick={onPick} />
              <AssetGroup heading="Tin trên sàn" items={listings} onPick={onPick} />
            </CommandList>
          </Command>
        )}
      </DialogContent>
    </Dialog>
  );
}
