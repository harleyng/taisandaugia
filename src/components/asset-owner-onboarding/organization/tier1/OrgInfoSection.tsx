import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { OrgKycScope, OrgType, RegistryAssetOwner } from "@/types/asset-owner";
import { ORG_TYPE_LABELS, OWNER_KIND_TO_ORG_TYPE } from "@/types/asset-owner";
import { AssetOwnerTypeahead } from "./AssetOwnerTypeahead";
import { BranchScopeField } from "./BranchScopeField";
import { OrgAliasesField } from "./OrgAliasesField";

interface Props {
  orgType: OrgType | "";
  orgName: string;
  /** Chủ tài sản đã chọn trong danh bạ; null = tên tự nhập tay. */
  linkedAssetOwner: RegistryAssetOwner | null;
  kycScope: OrgKycScope;
  /** Công ty mẹ đã khai (chỉ với hồ sơ chi nhánh). */
  parentOwner: RegistryAssetOwner | null;
  taxCode: string;
  officialEmail: string;
  aliases: string[];
  onChange: (fields: Partial<{
    org_type: OrgType;
    org_name: string;
    linked_asset_owner_id: string | null;
    kyc_scope: OrgKycScope;
    parent_asset_owner_id: string | null;
    tax_code: string;
    official_email: string;
    email_domain: string;
    aliases: string[];
  }>) => void;
  /** Đồng bộ entity đã chọn lên form cha để giữ nguyên khi quay lại bản nháp. */
  onSelectRegistryOwner: (owner: RegistryAssetOwner | null) => void;
  onSelectParentOwner: (owner: RegistryAssetOwner | null) => void;
}

/** Thẻ công ty mẹ dựng từ embed `parent` của một bản ghi chi nhánh. */
const parentCard = (p: { id: string; name: string }): RegistryAssetOwner => ({
  id: p.id, name: p.name, address: null, owner_kind: null, aliases: [],
});

export const OrgInfoSection = ({
  orgType, orgName, linkedAssetOwner, kycScope, parentOwner, taxCode, officialEmail, aliases,
  onChange, onSelectRegistryOwner, onSelectParentOwner,
}: Props) => {
  const isBranch = kycScope === "branch";

  // Tự nhập tay khi tổ chức chưa có trong danh bạ. null = chưa chọn chế độ, suy
  // ra từ dữ liệu: bản nháp đã có tên mà không kèm entity danh bạ chính là hồ sơ
  // nhập tay trước đó. Suy ra chứ không chốt lúc mount, vì prefill từ orgKyc chạy
  // ở effect — sau lần render đầu tiên của section này.
  const [manualToggle, setManualToggle] = useState<boolean | null>(null);
  const manualName = manualToggle ?? (!!orgName && !linkedAssetOwner);

  const orgTypeFrom = (owner: RegistryAssetOwner) =>
    // Chỉ điền hộ loại tổ chức khi người khai chưa chọn, tránh ghi đè lựa chọn của họ.
    !orgType && owner.owner_kind && OWNER_KIND_TO_ORG_TYPE[owner.owner_kind]
      ? { org_type: OWNER_KIND_TO_ORG_TYPE[owner.owner_kind] }
      : {};

  const selectRegistryOwner = (owner: RegistryAssetOwner) => {
    onSelectRegistryOwner(owner);
    if (owner.parent) {
      // Danh bạ đã biết đây là chi nhánh ⇒ hồ sơ rút gọn, công ty mẹ lấy theo danh bạ.
      onSelectParentOwner(parentCard(owner.parent));
      onChange({
        org_name: owner.name,
        linked_asset_owner_id: owner.id,
        kyc_scope: "branch",
        parent_asset_owner_id: owner.parent.id,
        ...orgTypeFrom(owner),
      });
      return;
    }
    // Gộp alias sẵn có của danh bạ vào danh sách người khai đang giữ — đây là
    // các tên gọi hệ thống đã biết chắc thuộc về tổ chức này.
    const merged = [...aliases];
    for (const a of owner.aliases ?? []) {
      if (!merged.some((x) => x.toLowerCase() === a.toLowerCase())) merged.push(a);
    }
    onChange({
      org_name: owner.name,
      linked_asset_owner_id: owner.id,
      aliases: merged,
      ...orgTypeFrom(owner),
    });
  };

  const clearRegistryOwner = () => {
    onSelectRegistryOwner(null);
    if (linkedAssetOwner?.parent) {
      // Phạm vi chi nhánh do danh bạ suy ra ⇒ bỏ chọn thì bỏ luôn.
      onSelectParentOwner(null);
      onChange({ org_name: "", linked_asset_owner_id: null, kyc_scope: "organization", parent_asset_owner_id: null });
    } else {
      onChange({ org_name: "", linked_asset_owner_id: null });
    }
    setManualToggle(false);
  };

  const toggleBranch = (branch: boolean) => {
    onSelectParentOwner(null);
    onChange({ kyc_scope: branch ? "branch" : "organization", parent_asset_owner_id: null });
  };

  const selectParent = (owner: RegistryAssetOwner | null) => {
    onSelectParentOwner(owner);
    onChange({ parent_asset_owner_id: owner?.id ?? null });
  };

  return (
    <Card className="rounded-2xl p-5 space-y-5">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">A</span>
        Thông tin tổ chức
      </h3>

      {/* Org type */}
      <div className="space-y-1.5">
        <Label>Loại tổ chức <span className="text-destructive">*</span></Label>
        <Select value={orgType} onValueChange={(v) => onChange({ org_type: v as OrgType })}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn loại tổ chức..." />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(ORG_TYPE_LABELS) as [OrgType, string][]).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Org name */}
      <div className="space-y-1.5">
        <Label htmlFor="org_name">
          {isBranch ? "Tên chi nhánh theo giấy tờ" : "Tên theo Giấy phép / Quyết định thành lập"}{" "}
          <span className="text-destructive">*</span>
        </Label>

        {manualName ? (
          <>
            <Input
              id="org_name"
              value={orgName}
              onChange={(e) => onChange({ org_name: e.target.value, linked_asset_owner_id: null })}
              placeholder="Ngân hàng TMCP Công Thương Việt Nam – Chi nhánh Đống Đa"
            />
            <button
              type="button"
              onClick={() => { setManualToggle(false); onChange({ org_name: "", linked_asset_owner_id: null }); }}
              className="text-xs text-primary hover:underline font-medium"
            >
              ← Chọn từ danh bạ chủ tài sản
            </button>
          </>
        ) : (
          <AssetOwnerTypeahead
            value={linkedAssetOwner}
            onSelect={selectRegistryOwner}
            onClear={clearRegistryOwner}
            onManual={() => setManualToggle(true)}
          />
        )}

        <p className="text-[11px] text-muted-foreground">
          {manualName
            ? "Nhập chính xác như trên giấy tờ pháp lý. Tên này không thể thay đổi sau khi được duyệt."
            : "Chọn đúng tổ chức trong danh bạ để hệ thống tự gán tài sản của bạn ngay khi hồ sơ được duyệt. Tên này không thể thay đổi sau khi được duyệt."}
        </p>
      </div>

      <BranchScopeField
        linkedOwner={linkedAssetOwner}
        kycScope={kycScope}
        parentOwner={parentOwner}
        onToggleBranch={toggleBranch}
        onSelectParent={selectParent}
      />

      {/* Trạm của chi nhánh khớp theo đúng thực thể — alias không dùng tới. */}
      {!isBranch && (
        <OrgAliasesField
          orgName={orgName}
          aliases={aliases}
          onChange={(next) => onChange({ aliases: next })}
        />
      )}

      {/* Tax code */}
      <div className="space-y-1.5">
        <Label htmlFor="tax_code">
          {isBranch ? (
            "MST chi nhánh (nếu có)"
          ) : (
            <>Mã số thuế / Mã cơ quan <span className="text-destructive">*</span></>
          )}
        </Label>
        <Input
          id="tax_code"
          value={taxCode}
          onChange={(e) => onChange({ tax_code: e.target.value })}
          placeholder={isBranch ? "0100112437-001" : "0123456789"}
        />
      </div>

      {/* Official email */}
      <div className="space-y-1.5">
        <Label htmlFor="official_email">Email công vụ <span className="text-destructive">*</span></Label>
        <Input
          id="official_email"
          type="email"
          value={officialEmail}
          onChange={(e) => {
            const email = e.target.value;
            const domain = email.includes("@") ? (email.split("@")[1] || "") : "";
            onChange({ official_email: email, email_domain: domain });
          }}
          placeholder="ten@tentochu.gov.vn"
        />
        <p className="text-[11px] text-muted-foreground">
          {isBranch
            ? "Email công vụ là căn cứ chính của hồ sơ chi nhánh — hãy dùng email có domain của ngân hàng / tổ chức."
            : "Sử dụng email có domain của tổ chức để tăng độ tin cậy."}
        </p>
      </div>
    </Card>
  );
};
