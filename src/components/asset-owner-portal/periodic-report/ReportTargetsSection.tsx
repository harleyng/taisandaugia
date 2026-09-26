import { Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { periodLabel } from "@/lib/ownerTargets";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";
import type { ReportPayload, ReportTarget } from "@/lib/ownerPeriodicReport";

const targetScope = (t: Pick<ReportTarget, "scope" | "branchName">) =>
  t.scope === "unit" ? "Toàn đơn vị" : t.branchName ?? "Chi nhánh";

/** L1 của báo cáo: đã thu bao nhiêu trong kỳ (so với chỉ tiêu của đúng phạm vi báo cáo, nếu có). */
export function ReportHero({ payload }: { payload: ReportPayload }) {
  const { money, meta } = payload;
  const target = payload.targets.find((t) => t.scope === meta.scope.kind && t.targetAmount !== null);
  const collected = moneyShortParts(money.collected);
  const period = periodLabel(meta.period.type, meta.period.start);
  const context = [
    target ? `${target.amountPct ?? 0}% chỉ tiêu ${formatMoneyShort(target.targetAmount)}` : null,
    `${money.soldCount} tài sản đấu thành`,
    money.awaiting > 0 ? `chờ thu ${formatMoneyShort(money.awaiting)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <HeroFigure
      label={`Đã thu ${period}`}
      value={collected.value}
      unit={collected.unit}
      progress={target?.amountPct ?? undefined}
      context={context}
    />
  );
}

function TargetRow({ t }: { t: ReportTarget }) {
  return (
    <li className="break-inside-avoid space-y-3 py-3 first:pt-0 last:pb-0">
      <p className="text-sm font-medium text-foreground">{targetScope(t)}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {t.targetAmount !== null && (
          <div className="space-y-1.5">
            <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>Thu hồi</span>
              <span className="tabular-nums">
                <span className="text-sm font-semibold text-foreground">{formatMoneyShort(t.collected)}</span> /{" "}
                {formatMoneyShort(t.targetAmount)} · {t.amountPct ?? 0}%
              </span>
            </p>
            <Progress value={Math.min(100, t.amountPct ?? 0)} className="h-1.5" aria-label="Tiến độ thu hồi" />
          </div>
        )}
        {t.targetCount !== null && (
          <div className="space-y-1.5">
            <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>Tài sản đấu thành</span>
              <span className="tabular-nums">
                <span className="text-sm font-semibold text-foreground">{t.soldCount}</span> / {t.targetCount} ·{" "}
                {t.countPct ?? 0}%
              </span>
            </p>
            <Progress value={Math.min(100, t.countPct ?? 0)} className="h-1.5" aria-label="Tiến độ số tài sản" />
          </div>
        )}
      </div>
      {(t.recorded > 0 || t.estimated > 0 || t.awaiting > 0) && (
        <p className="text-xs text-muted-foreground">
          Đơn vị đã ghi nhận thu {formatMoneyShort(t.recorded)} · tạm tính theo giá trúng {formatMoneyShort(t.estimated)}
          {t.awaiting > 0 && ` · còn chờ thu ${formatMoneyShort(t.awaiting)}`}
        </p>
      )}
    </li>
  );
}

/** Phần 1 — tiến độ chỉ tiêu của kỳ (cả đơn vị + từng chi nhánh khi báo cáo cả đơn vị). */
export function ReportTargetsSection({ payload }: { payload: ReportPayload }) {
  const period = periodLabel(payload.meta.period.type, payload.meta.period.start);
  return (
    <SectionCard title="1. Tiến độ chỉ tiêu" icon={Target} className="break-inside-avoid">
      {payload.targets.length ? (
        <ul className="divide-y">
          {payload.targets.map((t, i) => (
            <TargetRow key={`${t.scope}-${t.branchName ?? ""}-${i}`} t={t} />
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={Target} tone="muted" title={`Chưa đặt chỉ tiêu cho ${period}.`} />
      )}
    </SectionCard>
  );
}
