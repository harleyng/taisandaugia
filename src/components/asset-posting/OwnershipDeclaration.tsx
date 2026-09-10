import { AlertCircle, PenLine } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ASSET_DECLARATION_CLAUSES, ASSET_DECLARATION_VERSION } from "@/constants/terms";
import { Group, Pill, TextField } from "./fields";
import { signatureFilled } from "./wizardSchema";

interface OwnershipDeclarationProps {
  accepted: boolean;
  name: string;
  onAcceptedChange: (v: boolean) => void;
  onNameChange: (v: string) => void;
  err?: string;
}

/**
 * Bản cam kết quyền sở hữu — thay cho giấy tờ đăng ký ở nhóm tài sản không có
 * sổ đỏ / cà-vẹt. Chữ ký điện tử = họ tên tự nhập.
 *
 * Dựng bằng Group/TextField/Pill của wizard chứ KHÔNG dùng shadcn Card như
 * TermsSection ở luồng KYC: wizard không có Card ở đâu cả, mọi panel đều là
 * Group bo rounded-xl, và TextField cho ô ký tên thừa hưởng đúng focus ring /
 * viền lỗi / dấu tick hợp lệ như mọi field khác trong form.
 */
export function OwnershipDeclaration({
  accepted,
  name,
  onAcceptedChange,
  onNameChange,
  err,
}: OwnershipDeclarationProps) {
  const signed = accepted && signatureFilled(name);

  return (
    <Group
      icon={<PenLine className="h-4 w-4" />}
      title="Bản cam kết quyền sở hữu"
      desc="Nhóm tài sản này không có giấy tờ đăng ký sở hữu — thay bằng cam kết của bạn"
      right={<Pill tone={signed ? "ok" : "muted"}>{signed ? "Đã ký" : "Chưa ký"}</Pill>}
    >
      <p className="text-[13.5px] font-semibold text-foreground mb-2">
        Bằng việc tích chọn và ký tên dưới đây, bạn cam kết:
      </p>
      <ol className="mb-3.5 space-y-2">
        {ASSET_DECLARATION_CLAUSES.map((clause, i) => (
          <li key={clause} className="flex gap-2.5 text-xs text-muted-foreground leading-relaxed">
            <span className="shrink-0 font-semibold text-primary">{i + 1}.</span>
            <span>{clause}</span>
          </li>
        ))}
      </ol>

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-3 mb-3.5">
        <Checkbox
          id="ownership-declaration"
          className="mt-0.5"
          checked={accepted}
          onCheckedChange={(checked) => onAcceptedChange(checked === true)}
        />
        <Label
          htmlFor="ownership-declaration"
          className="text-sm font-normal leading-snug text-foreground cursor-pointer"
        >
          Tôi đã đọc, hiểu và đồng ý với toàn bộ nội dung cam kết trên.
        </Label>
      </div>

      <TextField
        label="Ký tên điện tử — họ và tên đầy đủ"
        req
        placeholder="VD: Nguyễn Văn A"
        value={name}
        onChange={onNameChange}
        help="Nhập đúng họ tên như trong hồ sơ xác thực Chủ tài sản. Việc tích chọn và nhập tên có giá trị như chữ ký của bạn."
      />

      {err && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-destructive mt-2.5">
          <AlertCircle className="h-3.5 w-3.5" /> {err}
        </div>
      )}

      {signed && (
        <p className="text-[11px] text-muted-foreground mt-2.5">
          Đã ký · Phiên bản cam kết {ASSET_DECLARATION_VERSION}
        </p>
      )}
    </Group>
  );
}
