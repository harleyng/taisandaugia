import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Sparkles, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAliasSuggestion } from "@/hooks/useProspects";
import type { OrgType, RegistryAssetOwner } from "@/types/asset-owner";
import { ORG_TYPE_LABELS, OWNER_KIND_TO_ORG_TYPE } from "@/types/asset-owner";
import { AssetOwnerTypeahead } from "./AssetOwnerTypeahead";

interface Props {
  orgType: OrgType | "";
  orgName: string;
  /** Chủ tài sản đã chọn trong danh bạ; null = tên tự nhập tay. */
  linkedAssetOwner: RegistryAssetOwner | null;
  taxCode: string;
  officialEmail: string;
  aliases: string[];
  onChange: (fields: Partial<{
    org_type: OrgType;
    org_name: string;
    linked_asset_owner_id: string | null;
    tax_code: string;
    official_email: string;
    email_domain: string;
    aliases: string[];
  }>) => void;
  /** Đồng bộ entity đã chọn lên form cha để giữ nguyên khi quay lại bản nháp. */
  onSelectRegistryOwner: (owner: RegistryAssetOwner | null) => void;
}

export const OrgInfoSection = ({
  orgType, orgName, linkedAssetOwner, taxCode, officialEmail, aliases,
  onChange, onSelectRegistryOwner,
}: Props) => {
  const [aliasInput, setAliasInput] = useState("");

  // Tự nhập tay khi tổ chức chưa có trong danh bạ. null = chưa chọn chế độ, suy
  // ra từ dữ liệu: bản nháp đã có tên mà không kèm entity danh bạ chính là hồ sơ
  // nhập tay trước đó. Suy ra chứ không chốt lúc mount, vì prefill từ orgKyc chạy
  // ở effect — sau lần render đầu tiên của section này.
  const [manualToggle, setManualToggle] = useState<boolean | null>(null);
  const manualName = manualToggle ?? (!!orgName && !linkedAssetOwner);

  const selectRegistryOwner = (owner: RegistryAssetOwner) => {
    onSelectRegistryOwner(owner);
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
      // Chỉ điền hộ loại tổ chức khi người khai chưa chọn, tránh ghi đè lựa chọn của họ.
      ...(!orgType && owner.owner_kind && OWNER_KIND_TO_ORG_TYPE[owner.owner_kind]
        ? { org_type: OWNER_KIND_TO_ORG_TYPE[owner.owner_kind] }
        : {}),
    });
  };

  const clearRegistryOwner = () => {
    onSelectRegistryOwner(null);
    onChange({ org_name: "", linked_asset_owner_id: null });
    setManualToggle(false);
  };

  // Debounce tên tổ chức trước khi hỏi gợi ý — tránh gọi RPC mỗi lần gõ phím.
  const [debouncedName, setDebouncedName] = useState(orgName);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(orgName), 500);
    return () => clearTimeout(t);
  }, [orgName]);

  const { data: suggestion, isFetching } = useAliasSuggestion(debouncedName);

  // Tự điền alias gợi ý MỘT lần cho mỗi tên tổ chức. Sau đó user toàn quyền
  // thêm/xoá — không ghi đè lựa chọn của họ khi component re-render.
  const appliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!suggestion?.aliases?.length) return;
    if (appliedFor.current === debouncedName) return;
    appliedFor.current = debouncedName;
    const merged = [...aliases];
    for (const a of suggestion.aliases) {
      if (!merged.some((x) => x.toLowerCase() === a.toLowerCase())) merged.push(a);
    }
    if (merged.length !== aliases.length) onChange({ aliases: merged });
  }, [suggestion, debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedSet = useMemo(
    () => new Set((suggestion?.aliases ?? []).map((a) => a.toLowerCase())),
    [suggestion],
  );

  const addAlias = () => {
    const v = aliasInput.trim();
    if (!v || aliases.some((a) => a.toLowerCase() === v.toLowerCase())) return;
    onChange({ aliases: [...aliases, v] });
    setAliasInput("");
  };

  const removeAlias = (i: number) => {
    onChange({ aliases: aliases.filter((_, j) => j !== i) });
  };

  const foundCount = suggestion?.total_listings ?? 0;

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
          Tên theo Giấy phép / Quyết định thành lập <span className="text-destructive">*</span>
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

      {/* Aliases — gợi ý tự động, user sửa được */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          Tên viết tắt / Tên thường gọi
          {isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </Label>

        <div className="flex gap-2">
          <Input
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }}
            placeholder="VietinBank, NH Công thương, CTG, ..."
            className="flex-1"
          />
          <Button type="button" variant="outline" size="icon" onClick={addAlias}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {aliases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {aliases.map((a, i) => {
              const isSuggested = suggestedSet.has(a.toLowerCase());
              return (
                <Badge
                  key={`${a}-${i}`}
                  variant={isSuggested ? "outline" : "secondary"}
                  className="gap-1 pr-1"
                >
                  {isSuggested && <Sparkles className="h-3 w-3 text-primary" />}
                  {a}
                  <button
                    type="button"
                    onClick={() => removeAlias(i)}
                    className="hover:text-destructive"
                    aria-label={`Xoá alias ${a}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary inline mr-0.5 align-[-2px]" />
          Hệ thống tự gợi ý từ tên tổ chức — bạn có thể xoá hoặc thêm. Danh sách này giúp chúng tôi
          tự tìm và gán tài sản của bạn ngay khi hồ sơ được duyệt.
        </p>

        {foundCount > 0 && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-foreground">
            Hệ thống đã tìm thấy <strong>{foundCount} tài sản</strong> trên sàn có thể thuộc về tổ
            chức của bạn. Chúng sẽ tự động xuất hiện trong danh mục sau khi hồ sơ được duyệt.
          </div>
        )}
      </div>

      {/* Tax code */}
      <div className="space-y-1.5">
        <Label htmlFor="tax_code">Mã số thuế / Mã cơ quan <span className="text-destructive">*</span></Label>
        <Input
          id="tax_code"
          value={taxCode}
          onChange={(e) => onChange({ tax_code: e.target.value })}
          placeholder="0123456789"
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
          Sử dụng email có domain của tổ chức để tăng độ tin cậy.
        </p>
      </div>
    </Card>
  );
};
