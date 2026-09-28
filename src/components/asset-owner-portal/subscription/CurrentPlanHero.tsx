import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SubPill, type SubPillTone } from "./SubPill";
import { EXPIRY_WARNING_DAYS, daysLeft, formatSubDate, vnToday } from "@/lib/ownerSubscription/status";
import {
  OWNER_SUBSCRIPTION_PLANS_PATH,
  ownerSubPlanCheckoutPath,
  ownerSubscriptionCheckoutPath,
} from "@/lib/ownerSubscription/paths";
import type { OwnerSubscriptionStatus } from "@/lib/ownerSubscription/types";


interface HeroState {
  pill: { tone: SubPillTone; label: string };
  range: string;
  left: string;
  leftWarn: boolean;
  cta: string | null;
  note: { tone: "warn" | "info"; text: string } | null;
}

function heroState(sub: OwnerSubscriptionStatus): HeroState {
  const left = daysLeft(sub.ends_on, vnToday()) ?? 0;
  const renew = `Gia hạn thêm ${sub.term_months} tháng`;
  const pending = sub.pending
    ? {
        tone: "info" as const,
        text: `Đã thanh toán gói ${sub.pending.plan_name} (${sub.pending.months} tháng) — áp dụng từ ${formatSubDate(sub.pending.from)}, nối tiếp ngay sau kỳ hiện tại.`,
      }
    : null;
  switch (sub.status) {
    case "active": {
      const soon = left <= EXPIRY_WARNING_DAYS;
      return {
        pill: soon ? { tone: "warn", label: "Sắp hết hạn" } : { tone: "ok", label: "Đang hiệu lực" },
        range: `Hiệu lực đến ${formatSubDate(sub.ends_on)}`,
        left: `còn ${left} ngày`,
        leftWarn: soon,
        cta: renew,
        note:
          pending ??
          (soon
            ? {
                tone: "warn",
                text: `Gia hạn trước ${formatSubDate(sub.ends_on)} để không gián đoạn — kỳ mới nối tiếp ngay sau kỳ hiện tại.`,
              }
            : null),
      };
    }
    case "scheduled":
      return {
        pill: { tone: "info", label: "Chờ bắt đầu" },
        range: `Bắt đầu ${formatSubDate(sub.starts_on)}`,
        left: `hiệu lực đến ${formatSubDate(sub.ends_on)}`,
        leftWarn: false,
        cta: renew,
        note: pending,
      };
    case "offered":
      return {
        pill: { tone: "info", label: "Chờ thanh toán" },
        range: "Chưa kích hoạt",
        left: "kích hoạt ngay khi thanh toán",
        leftWarn: false,
        cta: "Thanh toán để kích hoạt",
        note: null,
      };
    case "expired":
      return {
        pill: { tone: "warn", label: "Hết hạn" },
        range: `Hết hạn ${formatSubDate(sub.ends_on)}`,
        left: `đã quá ${Math.max(1 - left, 1)} ngày`,
        leftWarn: false,
        cta: "Gia hạn gói",
        note: { tone: "warn", text: "Gói đã hết hạn — thành viên đang trả credit như chủ tài sản cá nhân." },
      };
    default:
      return {
        pill: { tone: "muted", label: "Đã huỷ" },
        range: "Gói đã huỷ",
        left: "thành viên đang trả credit",
        leftWarn: false,
        cta: null,
        note: null,
      };
  }
}

/** Khung "Gói hiện tại" (.cur-l trong design) — tên gói, trạng thái, hiệu lực, gia hạn. */
export function CurrentPlanHero({ sub }: { sub: OwnerSubscriptionStatus }) {
  const navigate = useNavigate();
  const tier = sub.plan_tier ?? "standard";
  const dark = tier !== "basic";
  const s = heroState(sub);

  // Gói danh mục gia hạn qua báo giá danh mục (giá hiện hành); gói riêng qua ?sub=.
  const checkoutPath = sub.plan_id
    ? sub.is_owner && !sub.pending
      ? ownerSubPlanCheckoutPath(sub.workspace_id, sub.plan_id, sub.term_months)
      : null
    : sub.can_pay
      ? ownerSubscriptionCheckoutPath(sub.id)
      : null;
  const hint = !s.cta || sub.pending
    ? null
    : !sub.is_owner
      ? "Chỉ Trưởng đơn vị gia hạn / đổi gói."
      : !checkoutPath
        ? "Liên hệ sàn để gia hạn gói."
        : null;

  return (
    <section
      className={cn(
        "sub-hero relative flex flex-wrap items-end gap-x-8 gap-y-[18px] overflow-hidden rounded-2xl px-[26px] py-[22px] shadow-sm",
        `sub-tier-${tier}`,
      )}
    >
      <div className="sub-art" aria-hidden />
      <div className="relative z-[1] min-w-0 flex-[1_1_320px]">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--sub-mut))]">Gói hiện tại</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <h2 className="flex-none whitespace-nowrap text-[30px] font-bold leading-[1.1] tracking-[-0.02em]">{sub.plan_name}</h2>
          <SubPill tone={s.pill.tone} onDark={dark}>{s.pill.label}</SubPill>
        </div>
        <p className="mt-2.5 text-[14.5px] tabular-nums">
          {s.range} ·{" "}
          <span
            className={cn(
              s.leftWarn && "font-semibold",
              s.leftWarn && (dark ? "text-[hsl(var(--tier-warn-on-dark))]" : "text-[hsl(var(--tier-warn-strong))]"),
            )}
          >
            {s.left}
          </span>
        </p>
      </div>
      <div className="relative z-[1] flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(OWNER_SUBSCRIPTION_PLANS_PATH)}
          className={cn(
            "text-[13.5px] font-semibold underline underline-offset-[3px]",
            dark ? "text-white decoration-white/45 hover:decoration-current" : "text-primary decoration-primary/40 hover:text-primary-hover hover:decoration-current",
          )}
        >
          Xem các gói khác
        </button>
        {s.cta && checkoutPath && (
          <button
            type="button"
            onClick={() => navigate(checkoutPath)}
            className="sub-btn-solid inline-flex h-[38px] items-center justify-center whitespace-nowrap rounded-lg px-4 text-[13.5px] font-semibold transition-colors"
          >
            {s.cta}
          </button>
        )}
        {hint && <span className="text-[13px] text-[hsl(var(--sub-mut))]">{hint}</span>}
      </div>
      {s.note && (
        <p
          className={cn(
            "relative z-[1] basis-full rounded-[10px] px-3 py-2.5 text-[13px] leading-normal",
            s.note.tone === "warn"
              ? "bg-[hsl(var(--tier-warn-bg))] text-[hsl(var(--tier-warn-fg))]"
              : dark
                ? "bg-white/10 text-white ring-1 ring-inset ring-white/20"
                : "bg-primary/10 text-foreground",
          )}
        >
          {s.note.text}
        </p>
      )}
    </section>
  );
}
