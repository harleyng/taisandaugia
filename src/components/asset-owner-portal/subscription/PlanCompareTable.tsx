import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { compareGroups, formatVndNumber, planTermPrice } from "@/lib/ownerSubscription/catalog";
import type { OwnerSubPlan } from "@/lib/ownerSubscription/types";

interface Props {
  plans: OwnerSubPlan[];
  currentPlanId: string | null;
  months: number;
  discountPct: number;
}

/** Nhãn "Gói hiện tại" trên đầu cột mini (.tg2 trong design). */
const CURRENT_TAG: Record<OwnerSubPlan["tier"], string> = {
  basic: "bg-primary text-primary-foreground",
  standard: "bg-white text-[hsl(var(--primary-hover))]",
  premium: "bg-[hsl(var(--tier-gold))] text-[hsl(var(--tier-gold-fg))]",
};

/**
 * Bảng so sánh chi tiết (#cmp trong design). Bảng không có hàng đầu — tên cột là dải thẻ
 * mini dính trên cùng (.stk), chỉ hiện khi bảng đã cuộn qua mép trên khung cuộn.
 */
export function PlanCompareTable({ plans, currentPlanId, months, discountPct }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const groups = compareGroups(plans, currentPlanId);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Khung cuộn của cổng là <main className="owner-canvas">, không phải window.
    const scroller = wrap.closest("main") ?? document.documentElement;
    const update = () => {
      const top = scroller === document.documentElement ? 0 : scroller.getBoundingClientRect().top;
      const r = wrap.getBoundingClientRect();
      const h = stickRef.current?.offsetHeight ?? 0;
      setStuck(r.top < top && r.bottom - top > h + 60);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const cellBg = (id: string) => (id === currentPlanId ? "bg-primary/[0.04]" : "");

  return (
    <>
      <div className="sticky top-0 z-[5] hidden h-0 md:block">
        <div
          ref={stickRef}
          className={cn(
            "grid bg-muted py-2.5 shadow-[0_8px_12px_-10px_hsl(var(--foreground)/0.25)] transition-[opacity,transform] duration-200",
            stuck ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
          )}
          style={{ gridTemplateColumns: `28% repeat(${plans.length}, minmax(0, 1fr))` }}
        >
          <span className="self-end pb-3 pl-3.5 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">So sánh</span>
          {plans.map((p) => {
            const price = planTermPrice(p.monthly_price_vnd, months, discountPct);
            return (
              <div
                key={p.id}
                className={cn("sub-mini relative mx-1.5 flex flex-col gap-1 overflow-hidden rounded-[14px] px-4 py-3.5", `sub-tier-${p.tier}`)}
              >
                <div className="sub-art" aria-hidden />
                <div className="relative z-[1] flex flex-wrap items-center gap-2">
                  <b className="text-base font-bold">{p.name}</b>
                  {p.id === currentPlanId && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", CURRENT_TAG[p.tier])}>Gói hiện tại</span>
                  )}
                </div>
                {p.fit_line && <p className="relative z-[1] text-[12.5px] text-[hsl(var(--sub-mut))]">{p.fit_line}</p>}
                <div className="relative z-[1] mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
                  <b className="text-xl font-[750] tracking-[-0.02em] text-[hsl(var(--sub-price))]">{formatVndNumber(price)}</b>
                  <span className="text-xs text-[hsl(var(--sub-mut))]">₫ / {months} tháng</span>
                </div>
                {discountPct > 0 && (
                  <div className="relative z-[1] flex items-center gap-1.5 text-xs tabular-nums text-[hsl(var(--sub-mut))]">
                    <s>{formatVndNumber(p.monthly_price_vnd * months)} ₫</s>
                    <span className="rounded-[5px] bg-[hsl(var(--sub-sv-bg))] px-1.5 py-0.5 text-[10.5px] font-extrabold text-[hsl(var(--sub-sv-fg))]">
                      −{discountPct}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div ref={wrapRef} className="overflow-hidden rounded-2xl border bg-card pb-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13.5px]">
            <colgroup>
              <col style={{ width: "28%" }} />
              {plans.map((p) => (
                <col key={p.id} />
              ))}
            </colgroup>
            <tbody>
              {groups.map((g, gi) => (
                <Fragment key={g.group}>
                  <tr>
                    <th
                      colSpan={plans.length + 1}
                      className={cn(
                        "bg-primary/10 px-3.5 py-2.5 pl-6 pr-6 text-left text-xs font-bold uppercase tracking-[0.06em] text-primary",
                        gi > 0 && "border-t-[12px] border-card",
                      )}
                    >
                      {g.group}
                    </th>
                  </tr>
                  {g.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="w-[28%] py-[11px] pl-6 pr-3.5 text-left align-top font-medium text-muted-foreground">
                        {row.label}
                      </th>
                      {plans.map((p, i) => {
                        const cell = row.cells[p.id];
                        return (
                          <td
                            key={p.id}
                            className={cn(
                              "px-3.5 py-[11px] text-left align-top tabular-nums",
                              i === plans.length - 1 && "pr-6",
                              cell.kind === "no"
                                ? "font-medium text-muted-foreground/70"
                                : cell.up
                                  ? "font-semibold text-primary"
                                  : "font-semibold",
                              cellBg(p.id),
                            )}
                          >
                            {cell.text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
