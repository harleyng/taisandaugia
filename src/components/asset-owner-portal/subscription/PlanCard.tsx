import { cn } from "@/lib/utils";
import { PLAN_CARD_MAX_LINES, formatVndNumber, planCardLines, planTermPrice, type PlanCta } from "@/lib/ownerSubscription/catalog";
import type { OwnerSubPlan } from "@/lib/ownerSubscription/types";

interface Props {
  plan: OwnerSubPlan;
  prev: OwnerSubPlan | null;
  months: number;
  discountPct: number;
  tag: string | null;
  cta: PlanCta;
  /** Khoá nút dù nhãn cho phép (không phải Trưởng đơn vị / đang có đổi gói chờ). */
  locked: boolean;
  lockedHint?: string;
  onSelect: () => void;
}

const CTA_TONE = {
  solid: "sub-btn-solid",
  gold: "sub-btn-gold",
  ghost: "sub-btn-ghost",
} as const;

/** Thẻ gói trong danh mục (.pc trong design). */
export function PlanCard({ plan, prev, months, discountPct, tag, cta, locked, lockedHint, onSelect }: Props) {
  const price = planTermPrice(plan.monthly_price_vnd, months, discountPct);
  const full = plan.monthly_price_vnd * months;
  const allLines = planCardLines(prev, plan);
  const lines = allLines.slice(0, PLAN_CARD_MAX_LINES);
  const hidden = allLines.length - lines.length;
  const disabled = cta.disabled || locked;

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3.5 rounded-2xl px-[22px] pb-[120px] pt-6",
        `sub-card-${plan.tier}`,
      )}
    >
      <div className="sub-art" aria-hidden />
      {tag && (
        <span className="absolute -top-[11px] left-[22px] z-[2] rounded-full bg-[hsl(var(--sub-tag-bg))] px-[11px] py-[3px] text-xs font-bold text-[hsl(var(--sub-tag-fg))]">
          {tag}
        </span>
      )}
      <div className="relative z-[1]">
        <h3 className="text-xl font-bold tracking-[-0.01em]">{plan.name}</h3>
        {plan.fit_line && <p className="mt-0.5 text-[13px] text-[hsl(var(--sub-mut))]">{plan.fit_line}</p>}
      </div>
      <div className="relative z-[1]">
        <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
          <b className="text-[28px] font-[750] leading-none tracking-[-0.03em] text-[hsl(var(--sub-price))]">
            {formatVndNumber(price)}
          </b>
          <span className="text-[13px] text-[hsl(var(--sub-mut))]">₫ / {months} tháng</span>
        </div>
        {discountPct > 0 && (
          <div className="mt-1.5 flex items-center gap-2 text-[13px] tabular-nums text-[hsl(var(--sub-mut))]">
            <s className="decoration-[1.5px]">{formatVndNumber(full)} ₫</s>
            <span className="rounded-md bg-[hsl(var(--sub-sv-bg))] px-2 py-[3px] text-[11px] font-extrabold uppercase tracking-[0.06em] text-[hsl(var(--sub-sv-fg))]">
              −{discountPct}%
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        title={locked && !cta.disabled ? lockedHint : undefined}
        onClick={onSelect}
        className={cn(
          "relative z-[1] mb-2.5 mt-4 inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-70",
          CTA_TONE[cta.tone],
        )}
      >
        {cta.label}
      </button>
      {plan.highlight_line && (
        <p className="relative z-[1] mt-1.5 text-center text-[13.5px] font-semibold text-[hsl(var(--sub-accent))]">
          {plan.highlight_line}
        </p>
      )}
      {prev && <p className="relative z-[1] mt-1 text-[13px] font-semibold">Mọi thứ trong {prev.name}, nâng lên:</p>}
      <ul className="relative z-[1] mt-1 flex flex-col gap-3">
        {lines.map((l) => (
          <li key={l.key} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2.5 text-[13.5px] leading-[1.4]">
            <svg
              viewBox="0 0 24 24"
              className="mt-0.5 h-4 w-4 fill-none stroke-[hsl(var(--sub-accent))]"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>
              {l.before}
              <b className="font-bold">{l.strong}</b>
              {l.after}
              {l.isNew && (
                <span className="ml-1.5 inline-block rounded-[5px] bg-[hsl(var(--sub-accent))] px-1.5 py-px align-[1px] text-[10.5px] font-extrabold tracking-[0.05em] text-[hsl(var(--sub-new-fg))]">
                  MỚI
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="relative z-[1] mt-1 pl-[26px] text-[13px] text-[hsl(var(--sub-mut))]">
          + {hidden} quyền lợi khác — xem bảng so sánh bên dưới
        </p>
      )}
    </article>
  );
}
