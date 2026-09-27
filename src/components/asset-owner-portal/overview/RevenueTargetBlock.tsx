import { useId, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OWNER_TARGET_NEW_HREF, type TargetProgress } from "@/lib/ownerTargets";
import { moneyShortParts } from "@/utils/money";
import { RecoveryBar } from "./RecoveryBar";
import { TargetGapCard } from "./TargetGapCard";

interface RevenueTargetBlockProps {
  /** Chỉ tiêu của đúng Đơn vị + Kỳ đang lọc; null khi chưa đặt. */
  progress: TargetProgress | null;
  scopeLabel: string;
  /** "tháng 9/2026" — dùng khi chưa có chỉ tiêu. */
  periodLabel: string;
  canManage: boolean;
  loading: boolean;
}

const count = (n: number) => n.toLocaleString("en-US");

// Nền xanh bạc hà chéo 115° của bản thiết kế, dựng từ token: primary phủ trên success
// (primary một mình ở độ mờ này ra xám, thiếu độ tươi của bản thiết kế).
const HERO_BG =
  "bg-card bg-[linear-gradient(115deg,hsl(var(--primary)/0.02)_0%,hsl(var(--primary)/0.05)_55%,hsl(var(--primary)/0.08)_100%),linear-gradient(115deg,hsl(var(--success)/0.04)_0%,hsl(var(--success)/0.08)_55%,hsl(var(--success)/0.13)_100%)]";

/** Vòm + chấm tròn góc dưới phải (sau thẻ trắng) — đúng bố cục bản thiết kế. */
function HeroDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <span className="absolute bottom-[-4px] right-[150px] h-12 w-[230px] rounded-t-[115px] bg-card/40" />
      <span className="absolute bottom-[-40px] right-[-50px] h-[250px] w-[150px] rounded-t-[75px] bg-card/25" />
      <span className="absolute bottom-0 right-[58px] h-[95px] w-[140px] rounded-t-[70px] bg-primary/[0.04]" />
      <span className="absolute bottom-[92px] right-2 h-14 w-14 rounded-full bg-card bg-[linear-gradient(hsl(var(--accent)/0.22),hsl(var(--accent)/0.22))]" />
      <span className="absolute bottom-2.5 right-[-34px] h-24 w-24 rounded-full bg-card/50" />
    </div>
  );
}

function PctPill({ pct }: { pct: number }) {
  return (
    <em className="mb-0.5 self-end rounded-full bg-primary px-2.5 py-[3px] text-[13px] font-bold not-italic text-primary-foreground">
      {pct}%
    </em>
  );
}

/** "42.6 / 60 tỷ" — số đã thu ghi theo đơn vị của chỉ tiêu; khác đơn vị mới in đơn vị riêng. */
function BigFigure({ value, unit, goal, pct }: { value: string; unit?: string; goal: string; pct: number }) {
  return (
    <div className="mb-4 mt-2.5 flex flex-wrap items-baseline gap-2.5 tabular-nums">
      <strong className="text-[58px] font-bold leading-[0.9] tracking-[-0.03em] text-primary-hover">{value}</strong>
      {unit && <span className="text-xl text-muted-foreground">{unit}</span>}
      <span className="text-xl text-muted-foreground">/ {goal}</span>
      <PctPill pct={pct} />
    </div>
  );
}

function AmountBody({ progress }: { progress: TargetProgress }) {
  const { summary, target } = progress;
  const collected = moneyShortParts(summary.collected);
  const goal = moneyShortParts(target.targetAmount);
  const hasCollected = summary.collected > 0;
  return (
    <>
      <BigFigure
        value={hasCollected ? collected.value : "0"}
        unit={hasCollected && collected.unit !== goal.unit ? collected.unit : undefined}
        goal={`${goal.value} ${goal.unit}`}
        pct={progress.amountPct ?? 0}
      />
      <RecoveryBar summary={summary} goal={target.targetAmount ?? 0} />
    </>
  );
}

/** Chỉ tiêu chỉ đặt số tài sản: cùng bố cục, đếm tài sản đấu thành. */
function CountBody({ progress }: { progress: TargetProgress }) {
  const pct = progress.countPct ?? 0;
  const sold = progress.summary.soldCount;
  return (
    <>
      <BigFigure value={count(sold)} goal={`${count(progress.target.targetCount ?? 0)} tài sản`} pct={pct} />
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-card" role="img" aria-label={`Đạt ${pct}% chỉ tiêu`}>
        <i className="block h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground">
        <i aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-primary" />
        Đã đấu thành <b className="font-semibold text-foreground">{count(sold)} tài sản</b>
      </p>
    </>
  );
}

function Eyebrow({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-primary">
      {children}
    </h2>
  );
}

/**
 * Khối chính của Tổng quan (bản thiết kế "Tổng Quan Chủ Tài Sản") — CHỈ XEM tiến độ
 * chỉ tiêu của Đơn vị + Kỳ đang lọc. Đặt / sửa chỉ tiêu ở trang riêng /chu-tai-san/chi-tieu.
 */
export function RevenueTargetBlock({ progress, scopeLabel, periodLabel, canManage, loading }: RevenueTargetBlockProps) {
  const navigate = useNavigate();
  const headingId = useId();

  if (loading) return <Skeleton className="h-[196px] rounded-2xl" aria-busy="true" />;

  const byCount = !!progress && progress.target.targetAmount === null;

  return (
    <section
      aria-labelledby={headingId}
      className={`relative overflow-hidden rounded-2xl px-[30px] py-7 shadow-card print:border print:shadow-none ${HERO_BG}`}
    >
      <HeroDecor />
      {!progress ? (
        <div className="relative z-[1] max-w-xl space-y-2">
          <Eyebrow id={headingId}>Chỉ tiêu doanh thu</Eyebrow>
          <p className="text-xl font-bold text-primary-hover">Chưa đặt chỉ tiêu {periodLabel}</p>
          <p className="text-[13px] text-muted-foreground">
            {canManage
              ? `Đặt chỉ tiêu thu hồi (${scopeLabel}) để theo dõi tiến độ mỗi ngày.`
              : "Trưởng đơn vị chưa đặt chỉ tiêu cho kỳ này."}
          </p>
          {canManage && (
            <Button size="sm" className="mt-1" onClick={() => navigate(OWNER_TARGET_NEW_HREF)}>
              Đặt chỉ tiêu
            </Button>
          )}
        </div>
      ) : (
        <div className="relative z-[1] grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <Eyebrow id={headingId}>{byCount ? "Chỉ tiêu tài sản đấu thành" : "Chỉ tiêu doanh thu"}</Eyebrow>
            {byCount ? <CountBody progress={progress} /> : <AmountBody progress={progress} />}
          </div>
          <TargetGapCard progress={progress} />
        </div>
      )}
    </section>
  );
}
