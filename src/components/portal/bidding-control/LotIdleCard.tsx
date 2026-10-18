import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotPill } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { cn } from "@/lib/utils";

/**
 * Sân khấu khi KHÔNG có lô đang đấu (design `.ox-stage.ox-idle`): lô tiếp theo
 * chờ mở, hoặc danh sách "Sẵn sàng điều hành" trước giờ bắt đầu.
 */

export interface IdleControl {
  label: string;
  hint: string;
  disabled: boolean;
  disabledTitle?: string;
  onClick?: () => void;
}

interface Props {
  eyebrow: string;
  pill?: string;
  title: string;
  /** Bốn ô số liệu — design `.ox-kv`. */
  facts?: [string, string][];
  /** Danh sách kiểm tra 2 cột — design `.ox-ck`. */
  checks?: { ok: boolean; title: string; sub: string }[];
  control?: IdleControl;
}

export function LotIdleCard({ eyebrow, pill, title, facts, checks, control }: Props) {
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl bg-card px-6 py-[22px] shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">{eyebrow}</span>
        {pill && <DotPill tone="muted">{pill}</DotPill>}
      </div>
      <h2 className="-mt-1.5 text-[19px] font-semibold tracking-[-0.01em] text-foreground [text-wrap:pretty]">{title}</h2>

      {facts && (
        <dl className="mb-1.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-[14.5px] font-semibold tabular-nums text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {checks && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {checks.map((c) => (
            <div key={c.title} className="flex items-start gap-2.5 rounded-[10px] bg-muted p-3">
              <i
                className={cn(
                  "mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full",
                  c.ok ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1.5px_hsl(var(--muted-foreground)/0.6)]",
                )}
              >
                {c.ok && <Check className="h-3 w-3" strokeWidth={3} />}
              </i>
              <span>
                <b className="block text-[13px] font-semibold text-foreground">{c.title}</b>
                <small className="text-xs text-muted-foreground">{c.sub}</small>
              </span>
            </div>
          ))}
        </div>
      )}

      {control && <Control {...control} />}
    </section>
  );
}

function Control({ label, hint, disabled, disabledTitle, onClick }: IdleControl) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button
        className="h-10 rounded-lg px-[18px] text-[13px] font-semibold"
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onClick={onClick}
      >
        {label}
      </Button>
      <span className="text-[12.5px] text-muted-foreground">{hint}</span>
    </div>
  );
}
