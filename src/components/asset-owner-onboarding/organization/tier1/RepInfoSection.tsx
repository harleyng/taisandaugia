import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { IdType } from "@/types/asset-owner";

interface Props {
  repFullName: string;
  repTitle: string;
  repIdType: IdType;
  repIdNumber: string;
  onChange: (fields: Partial<{
    rep_full_name: string;
    rep_title: string;
    rep_id_type: IdType;
    rep_id_number: string;
  }>) => void;
}

export const RepInfoSection = ({
  repFullName, repTitle, repIdType, repIdNumber, onChange,
}: Props) => (
  <Card className="rounded-2xl p-5 space-y-5">
    <div>
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">B</span>
        Người đại diện / Được ủy quyền
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">
        Người đại diện theo pháp luật hoặc người được ủy quyền thực hiện KYC thay tổ chức.
      </p>
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="rep_name">Họ và tên <span className="text-destructive">*</span></Label>
      <Input
        id="rep_name"
        value={repFullName}
        onChange={(e) => onChange({ rep_full_name: e.target.value })}
        placeholder="Nguyễn Thị B"
      />
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="rep_title">Chức vụ <span className="text-destructive">*</span></Label>
      <Input
        id="rep_title"
        value={repTitle}
        onChange={(e) => onChange({ rep_title: e.target.value })}
        placeholder="Giám đốc / Trưởng phòng Pháp lý / ..."
      />
    </div>

    <div className="space-y-2">
      <Label>Loại giấy tờ tùy thân <span className="text-destructive">*</span></Label>
      <RadioGroup
        value={repIdType}
        onValueChange={(v) => onChange({ rep_id_type: v as IdType })}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="cccd" id="rep_cccd" />
          <Label htmlFor="rep_cccd" className="font-normal cursor-pointer">CCCD / CMND</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="passport" id="rep_passport" />
          <Label htmlFor="rep_passport" className="font-normal cursor-pointer">Hộ chiếu</Label>
        </div>
      </RadioGroup>
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="rep_id_number">
        {repIdType === "cccd" ? "Số CCCD / CMND" : "Số hộ chiếu"}{" "}
        <span className="text-destructive">*</span>
      </Label>
      <Input
        id="rep_id_number"
        value={repIdNumber}
        onChange={(e) => onChange({ rep_id_number: e.target.value })}
        placeholder={repIdType === "cccd" ? "9–12 chữ số" : "≥ 6 ký tự"}
      />
    </div>
  </Card>
);
