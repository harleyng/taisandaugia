import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CpdCreditMode } from "@/types/cpd-catalog";
import { CPD_CREDIT_MODE_LABELS } from "@/types/cpd-catalog";

interface Props {
  creditMode: CpdCreditMode;
  fixedHours: string;
  onCreditMode: (v: CpdCreditMode) => void;
  onFixedHours: (v: string) => void;
  /** Đặt trước ô để nói rõ quy tắc này áp cho hình thức hay cho vai trò. */
  scopeHint?: string;
}

/**
 * Hai trường quyết định CÁCH TÍNH, dùng chung cho hình thức và vai trò — chúng
 * là cùng một quy tắc ở hai cấp, tách ra hai bản sao là mời gọi trôi lệch.
 */
export function CreditRuleFields({
  creditMode, fixedHours, onCreditMode, onFixedHours, scopeHint,
}: Props) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      {scopeHint && <p className="text-xs text-muted-foreground">{scopeHint}</p>}

      <div className="space-y-1.5">
        <label className="text-xs font-medium">Cách tính</label>
        <Select value={creditMode} onValueChange={(v) => onCreditMode(v as CpdCreditMode)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(CPD_CREDIT_MODE_LABELS) as CpdCreditMode[]).map((m) => (
              <SelectItem key={m} value={m}>{CPD_CREDIT_MODE_LABELS[m]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {creditMode === "FULL_YEAR"
            ? "Một lần ghi nhận là hoàn thành nghĩa vụ cả năm, bất kể số giờ (Điều 26.2)."
            : "Cộng giờ vào mốc tối thiểu 8 giờ/năm (Điều 26.1)."}
        </p>
      </div>

      {creditMode === "HOURS" && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Số giờ quy đổi mỗi lần</label>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={fixedHours}
            onChange={(e) => onFixedHours(e.target.value)}
            placeholder="Để trống nếu tổ chức tự khai số giờ thực tế"
          />
          <p className="text-xs text-muted-foreground">
            Có số: mọi bản ghi đều được tính đúng số giờ này và tổ chức không sửa
            được. Để trống: tổ chức nhập số giờ thực tế của khoá.
          </p>
        </div>
      )}
    </div>
  );
}
