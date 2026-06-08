import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { OrgType } from "@/types/asset-owner";
import { ORG_TYPE_LABELS } from "@/types/asset-owner";

interface Props {
  orgType: OrgType | "";
  orgName: string;
  taxCode: string;
  officialEmail: string;
  aliases: string[];
  onChange: (fields: Partial<{
    org_type: OrgType;
    org_name: string;
    tax_code: string;
    official_email: string;
    email_domain: string;
    aliases: string[];
  }>) => void;
}

export const OrgInfoSection = ({
  orgType, orgName, taxCode, officialEmail, aliases, onChange,
}: Props) => {
  const [aliasInput, setAliasInput] = useState("");

  const addAlias = () => {
    const v = aliasInput.trim();
    if (!v || aliases.includes(v)) return;
    onChange({ aliases: [...aliases, v] });
    setAliasInput("");
  };

  const removeAlias = (i: number) => {
    onChange({ aliases: aliases.filter((_, j) => j !== i) });
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
          Tên theo Giấy phép / Quyết định thành lập <span className="text-destructive">*</span>
        </Label>
        <Input
          id="org_name"
          value={orgName}
          onChange={(e) => onChange({ org_name: e.target.value })}
          placeholder="Ngân hàng TMCP Vietcombank – Chi nhánh Hà Nội"
        />
        <p className="text-[11px] text-muted-foreground">
          Nhập chính xác như trên giấy tờ pháp lý. Tên này không thể thay đổi sau khi được duyệt.
        </p>
      </div>

      {/* Aliases */}
      <div className="space-y-1.5">
        <Label>Tên viết tắt / Tên thường gọi <span className="text-muted-foreground font-normal">(tuỳ chọn)</span></Label>
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
            {aliases.map((a, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pr-1">
                {a}
                <button onClick={() => removeAlias(i)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Giúp hệ thống tìm tài sản của bạn chính xác hơn ở bước tiếp theo.
        </p>
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
