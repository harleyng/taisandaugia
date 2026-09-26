import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupNumber, parseNumber, formatVnd } from "@/lib/advertising/slug";
import { bidStepPercent, depositVnd, depositWarning, toNum } from "@/lib/auctionConsult/proposal";
import type { AuctionConsultation, ProposalDraft } from "@/types/auctionConsult";

interface Props {
  draft: ProposalDraft;
  onChange: (patch: Partial<ProposalDraft>) => void;
  row: Pick<AuctionConsultation, "expected_price" | "min_acceptable_price">;
  disabled?: boolean;
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  hint,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        disabled={disabled}
        value={value ? groupNumber(value) : ""}
        placeholder="0"
        onChange={(e) => {
          const n = parseNumber(e.target.value);
          onChange(n ? String(n) : "");
        }}
      />
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Giá khởi điểm / giá bảo lưu / bước giá / tiền đặt trước của phương án. */
export function ProposalPriceFields({ draft, onChange, row, disabled }: Props) {
  const start = toNum(draft.starting_price);
  const stepPct = bidStepPercent(toNum(draft.bid_step), start);
  const depValue = toNum(draft.deposit_value);
  const depVnd = depositVnd(draft.deposit_mode, depValue, start);
  const warn = depositWarning(draft.deposit_mode, depValue, start);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="tvdg-start"
          label="Giá khởi điểm (₫)"
          value={draft.starting_price}
          disabled={disabled}
          onChange={(v) => onChange({ starting_price: v })}
          hint={
            <>
              Người bán mong muốn {row.expected_price ? formatVnd(row.expected_price) : "—"} · thấp nhất{" "}
              {row.min_acceptable_price ? formatVnd(row.min_acceptable_price) : "—"}
            </>
          }
        />
        <MoneyField
          id="tvdg-reserve"
          label="Giá bảo lưu (₫, tuỳ chọn)"
          value={draft.reserve_price}
          disabled={disabled}
          onChange={(v) => onChange({ reserve_price: v })}
          hint="Riêng tư, không công bố. Trả giá lên: ≥ giá khởi điểm; đặt giá xuống: ≤ giá khởi điểm."
        />
        <MoneyField
          id="tvdg-step"
          label="Bước giá (₫)"
          value={draft.bid_step}
          disabled={disabled}
          onChange={(v) => onChange({ bid_step: v })}
          hint={stepPct != null ? `${stepPct}% giá khởi điểm` : undefined}
        />
        <div className="space-y-1.5">
          <Label htmlFor="tvdg-deposit">Tiền đặt trước</Label>
          <div className="flex gap-2">
            <div className="flex shrink-0 rounded-lg border border-input p-0.5">
              {(["percent", "amount"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ deposit_mode: m, deposit_value: "" })}
                  className={`rounded-md px-2.5 text-sm ${
                    draft.deposit_mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m === "percent" ? "%" : "₫"}
                </button>
              ))}
            </div>
            <Input
              id="tvdg-deposit"
              inputMode="decimal"
              disabled={disabled}
              value={draft.deposit_mode === "amount" && draft.deposit_value ? groupNumber(draft.deposit_value) : draft.deposit_value}
              placeholder={draft.deposit_mode === "percent" ? "10" : "0"}
              onChange={(e) =>
                onChange({
                  deposit_value:
                    draft.deposit_mode === "amount"
                      ? String(parseNumber(e.target.value) || "")
                      : e.target.value.replace(/[^\d.]/g, ""),
                })
              }
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {draft.deposit_mode === "percent" && depVnd != null && `≈ ${formatVnd(depVnd)}`}
            {warn && (
              <span className="mt-0.5 flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3 w-3" /> {warn}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
