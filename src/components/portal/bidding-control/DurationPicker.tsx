import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CUSTOM, DURATION_PRESETS, isValidDurationMinutes, UNTIL_END } from "@/lib/bidding/controlAccess";

/**
 * Chọn thời lượng trả giá / nhận phiếu: mốc bấm nhanh, tuỳ chọn số phút, và (tuỳ
 * nơi gọi) "Đến hết phiên". Dùng chung cho Mở tài sản và Mở vòng phụ.
 */

interface Props {
  idPrefix: string;
  choice: string;
  custom: string;
  onChoice: (v: string) => void;
  onCustom: (v: string) => void;
  /** Bỏ phiếu kín / vòng phụ BẮT BUỘC có thời lượng ⇒ ẩn "Đến hết phiên". */
  allowUntilEnd: boolean;
}

export function DurationPicker({ idPrefix, choice, custom, onChoice, onCustom, allowUntilEnd }: Props) {
  const customInvalid = choice === CUSTOM && custom !== "" && !isValidDurationMinutes(Number(custom));
  return (
    <>
      <RadioGroup value={choice} onValueChange={onChoice} className="gap-2">
        {DURATION_PRESETS.map((m) => (
          <div key={m} className="flex items-center gap-2">
            <RadioGroupItem value={String(m)} id={`${idPrefix}-${m}`} />
            <Label htmlFor={`${idPrefix}-${m}`} className="font-normal">
              {m} phút
            </Label>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <RadioGroupItem value={CUSTOM} id={`${idPrefix}-custom`} />
          <Label htmlFor={`${idPrefix}-custom`} className="font-normal">
            Tuỳ chọn
          </Label>
          <NumberInput
            value={custom}
            onChange={onCustom}
            allowDecimal={false}
            placeholder="phút"
            className="h-8 w-24"
            onFocus={() => onChoice(CUSTOM)}
          />
        </div>
        {allowUntilEnd && (
          <div className="flex items-center gap-2">
            <RadioGroupItem value={UNTIL_END} id={`${idPrefix}-end`} />
            <Label htmlFor={`${idPrefix}-end`} className="font-normal">
              Đến hết phiên
            </Label>
          </div>
        )}
      </RadioGroup>
      {customInvalid && <p className="text-xs text-destructive">Nhập số phút nguyên từ 1 đến 1.440 (24 giờ).</p>}
    </>
  );
}
