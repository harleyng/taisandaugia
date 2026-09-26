import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { groupNumber, parseNumber } from "@/lib/advertising/slug";
import type { QuoteTerms } from "@/lib/serviceRequests/form";

/** Giá · hiệu lực · ghi chú — phần chung của mọi dialog báo giá (khớp kiểm tra ở RPC admin_quote_*). */
export function QuoteTermsFields({
  value,
  onChange,
  pricePlaceholder,
  notePlaceholder,
  noteMaxLength = 1000,
}: {
  value: QuoteTerms;
  onChange: (next: QuoteTerms) => void;
  pricePlaceholder: string;
  notePlaceholder: string;
  noteMaxLength?: number;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="quote-price">Giá dịch vụ (VND)</Label>
          <Input
            id="quote-price"
            inputMode="numeric"
            value={value.price ? groupNumber(value.price) : ""}
            placeholder={pricePlaceholder}
            onChange={(e) => onChange({ ...value, price: parseNumber(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quote-days">Hiệu lực báo giá (ngày)</Label>
          <Input
            id="quote-days"
            type="number"
            min={1}
            max={60}
            value={value.validDays}
            onChange={(e) => onChange({ ...value, validDays: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quote-note">Ghi chú báo giá</Label>
        <Textarea
          id="quote-note"
          rows={3}
          maxLength={noteMaxLength}
          value={value.note}
          placeholder={notePlaceholder}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </div>
    </>
  );
}
