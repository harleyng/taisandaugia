import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { GitBranch } from "lucide-react";
import { useOwnerEntityListingCount } from "@/hooks/useOwnerEntityListingCount";
import type { OrgKycScope, RegistryAssetOwner } from "@/types/asset-owner";
import { AssetOwnerTypeahead } from "./AssetOwnerTypeahead";

interface Props {
  /** Thực thể đã chọn trong danh bạ ở ô tên (null = tự nhập tay). */
  linkedOwner: RegistryAssetOwner | null;
  kycScope: OrgKycScope;
  /** Công ty mẹ đã khai (hiện thẻ đã chọn trong ô chọn công ty mẹ). */
  parentOwner: RegistryAssetOwner | null;
  onToggleBranch: (isBranch: boolean) => void;
  onSelectParent: (owner: RegistryAssetOwner | null) => void;
}

const LIGHT_KYC_NOTE =
  "Hồ sơ rút gọn cho chi nhánh: chỉ cần email công vụ, giấy giao việc / uỷ quyền của Giám đốc chi nhánh và giấy tờ tuỳ thân của cán bộ.";

/**
 * Chi nhánh tự onboard (Phase 13). Thực thể danh bạ đã là chi nhánh ⇒ chỉ báo
 * "Chi nhánh của «mẹ»". Còn lại ⇒ ô đánh dấu + chọn công ty mẹ; chi nhánh chưa có
 * trong danh bạ sẽ được tạo dưới công ty mẹ này khi hồ sơ được duyệt.
 */
export const BranchScopeField = ({
  linkedOwner, kycScope, parentOwner, onToggleBranch, onSelectParent,
}: Props) => {
  const isBranch = kycScope === "branch";
  const { data: ownListings } = useOwnerEntityListingCount(isBranch ? linkedOwner?.id : null);

  const scopeLine = linkedOwner
    ? `Trạm Điều Hành chỉ nhận tài sản đứng tên «${linkedOwner.name}»${
        ownListings !== undefined ? ` — hiện có ${ownListings} tài sản trên sàn` : ""
      }. Tài sản của trụ sở và chi nhánh khác không tự động gán vào.`
    : "Chi nhánh chưa có trong danh bạ sẽ được tạo dưới tổ chức mẹ khi hồ sơ được duyệt. Tài sản của trụ sở và chi nhánh khác không tự động gán vào.";

  if (linkedOwner?.parent) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <GitBranch className="h-4 w-4 text-primary" strokeWidth={1.5} />
          Chi nhánh của «{linkedOwner.parent.name}»
        </p>
        <p className="text-xs text-muted-foreground">{LIGHT_KYC_NOTE}</p>
        <p className="text-xs text-muted-foreground">{scopeLine}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="org_is_branch"
          checked={isBranch}
          onCheckedChange={(v) => onToggleBranch(!!v)}
          className="mt-0.5"
        />
        <Label htmlFor="org_is_branch" className="font-normal text-sm cursor-pointer leading-relaxed">
          Đơn vị của tôi là <strong>chi nhánh / phòng giao dịch</strong> của một ngân hàng hoặc tổ chức
        </Label>
      </div>

      {isBranch && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <Label>
            Ngân hàng / tổ chức mẹ <span className="text-destructive">*</span>
          </Label>
          <AssetOwnerTypeahead
            value={parentOwner}
            onSelect={(o) => onSelectParent(o)}
            onClear={() => onSelectParent(null)}
            excludeId={linkedOwner?.id ?? null}
            placeholder="Tìm ngân hàng / tổ chức mẹ..."
            selectedHint="Tổ chức mẹ của chi nhánh"
          />
          <p className="text-xs text-muted-foreground">{LIGHT_KYC_NOTE}</p>
          <p className="text-xs text-muted-foreground">{scopeLine}</p>
        </div>
      )}
    </div>
  );
};
