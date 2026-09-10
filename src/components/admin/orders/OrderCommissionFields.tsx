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
import type { ResolvedContractTerms } from "@/types/supplierContract";
import { FileSignature, AlertTriangle } from "lucide-react";
import { previewCommission } from "./commission";

interface Props {
  supplierName: string | null;
  /** Điều khoản lấy từ hợp đồng đang hiệu lực; null = chưa có hợp đồng phủ. */
  contractTerms: ResolvedContractTerms | null;
  grossAmount: number;
  commissionType: CommissionType;
  commissionValue: number;
  quantity: number;
  onGrossChange: (v: number) => void;
  onTypeChange: (v: CommissionType) => void;
  onValueChange: (v: number) => void;
}


const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN") : null;

export function OrderCommissionFields({
  supplierName,
  contractTerms,
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

      {/* Nguồn của mức hoa hồng. Không có hợp đồng KHÔNG chặn tạo đơn — chỉ nói
          rõ rằng con số đang là nhập tay, không có gì bảo chứng. */}
      {contractTerms ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-primary/5 px-3 py-2 text-xs">
          <FileSignature className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-foreground">
            Theo hợp đồng số <strong>{contractTerms.contract_no}</strong>
          </span>
          <span className="text-muted-foreground">
            {contractTerms.effective_to
              ? `· hết hạn ${fmtDate(contractTerms.effective_to)}`
              : "· vô thời hạn"}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-amber-800">
            Chưa có hợp đồng hiệu lực cho dịch vụ này — mức dưới đây là nhập tay.
          </span>
        </div>
      )}

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
