import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { planTermPrice } from "@/lib/ownerSubscription/catalog";
import { type PlanDraft, packageTerms, sortTerms, termLabel, toggleTerm } from "@/lib/ownerSubscription/packages";
import type { SubTerm } from "@/lib/ownerSubscription/types";

interface Props {
  library: SubTerm[];
  selected: string[];
  plans: PlanDraft[];
  canEdit: boolean;
  onChange: (termIds: string[]) => void;
}

export function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "grid h-4 w-4 shrink-0 place-items-center rounded border-[1.5px]",
        on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
      )}
    >
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

/** Thẻ "Kỳ mua": chọn kỳ từ thư viện + bảng giá từng gói theo kỳ. */
export function PackageTermsCard({ library, selected, plans, canEdit, onChange }: Props) {
  const navigate = useNavigate();
  const chosen = packageTerms(selected, library);
  const selling = plans.filter((p) => p.is_active);

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5">
        <h2 className="text-base font-semibold text-foreground">Kỳ mua</h2>
        <span className="flex-1 text-xs text-muted-foreground">Chọn từ thư viện · mỗi số tháng một kỳ</span>
        <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => navigate("/admin/goi-thue-bao/ky-mua")}>
          Quản lý thư viện kỳ
        </button>
      </div>
      <div className="flex flex-col gap-3.5 p-5 pt-3.5">
        {library.length === 0 ? (
          <p className="text-sm text-muted-foreground">Thư viện chưa có kỳ nào — thêm kỳ ở trang Kỳ mua &amp; chiết khấu.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {sortTerms(library).map((t) => {
              const on = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!canEdit}
                  onClick={() => onChange(toggleTerm(selected, t, library))}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-default",
                    on ? "border-primary bg-primary/5" : "border-input bg-card hover:border-primary/50",
                  )}
                >
                  <span className="mt-0.5">
                    <CheckBox on={on} />
                  </span>
                  <span className="min-w-0">
                    <b className="block whitespace-nowrap text-[13.5px] text-foreground">{termLabel(t)}</b>
                    {t.note && <span className="block text-[11.5px] text-muted-foreground">{t.note}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {chosen.length > 0 && selling.length > 0 && (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Giá theo kỳ</th>
                  {chosen.map((t) => (
                    <th key={t.id} className="whitespace-nowrap px-3 py-2 text-right font-semibold uppercase tracking-wide">
                      {termLabel(t, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selling.map((p) => (
                  <tr key={p.key} className="border-t">
                    <td className="px-3 py-2 font-semibold text-foreground">{p.name}</td>
                    {chosen.map((t) => (
                      <td key={t.id} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {formatMoneyFull(planTermPrice(p.monthly_price_vnd, t.months, t.discount_pct))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
