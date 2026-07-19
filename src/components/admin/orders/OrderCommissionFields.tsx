import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupNumber, parseNumber, formatVnd } from "@/lib/advertising/slug";
import type { CommissionType } from "@/types/orders";

interface Props {
  supplierName: string | null;
  grossAmount: number;
  commissionType: CommissionType;
  commissionValue: number;
  quantity: number;
  onGrossChange: (v: number) => void;
  onTypeChange: (v: CommissionType) => void;
  onValueChange: (v: number) => void;
}

/** Bản xem trước phải khớp CÔNG THỨC TRIGGER trong DB:
 *  percent → round(gross * value / 100) · fixed → round(value * quantity) */
export const previewCommission = (
  type: CommissionType,
  value: number,
  gross: number,
  quantity: number,
): number =>
  type === "percent" ? Math.round((gross * value) / 100) : Math.round(value * quantity);

export function OrderCommissionFields({
  supplierName,
  grossAmount,
  commissionType,
  commissionValue,
  quantity,
  onGrossChange,
  onTypeChange,
  onValueChange,
}: Props) {
  const isPercent = commissionType === "percent";
  const revenue = previewCommission(commissionType, commissionValue, grossAmount, quantity);
  const payable = Math.max(grossAmount - revenue, 0);

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Hoa hồng môi giới</p>
        <span className="text-xs text-muted-foreground">
          NCC: {supplierName ?? "—"}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label>Giá trị hợp đồng (VND) <span className="text-destructive">*</span></Label>
        <Input
          inputMode="numeric"
          value={groupNumber(grossAmount)}
          onChange={(e) => onGrossChange(parseNumber(e.target.value))}
          placeholder="800,000,000"
        />
        <p className="text-[11px] text-muted-foreground">
          Tổng tiền khách trả cho nhà cung cấp. Không tính vào doanh thu sàn.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Cách tính</Label>
          <Select
            value={commissionType}
            onValueChange={(v) => onTypeChange(v as CommissionType)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Phần trăm (%)</SelectItem>
              <SelectItem value="fixed">Cố định / đơn vị</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{isPercent ? "Tỷ lệ (%)" : "Hoa hồng / đơn vị (VND)"}</Label>
          {isPercent ? (
            // parseNumber strip dấu chấm thập phân ⇒ 12.5 thành 125.
            <Input
              type="number" step="0.01" min="0" max="100"
              value={commissionValue || ""}
              onChange={(e) => onValueChange(Number(e.target.value))}
              placeholder="12.5"
            />
          ) : (
            <Input
              inputMode="numeric"
              value={groupNumber(commissionValue)}
              onChange={(e) => onValueChange(parseNumber(e.target.value))}
              placeholder="3,000,000"
            />
          )}
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Doanh thu ghi nhận</span>
          <span className="font-semibold tabular-nums text-foreground">{formatVnd(revenue)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Trả nhà cung cấp</span>
          <span className="tabular-nums text-muted-foreground">{formatVnd(payable)}</span>
        </div>
      </div>
    </div>
  );
}
