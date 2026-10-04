import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { cn } from "@/lib/utils";
import {
  formatCount,
  impactMetrics,
  windowDays,
  type Delta,
  type OrderImpact as OrderImpactData,
} from "@/lib/ownerMarketing/orderReport";
import { formatShortDate } from "../format";
import { OrderViewsBars } from "./OrderViewsBars";

function DeltaPill({ delta }: { delta: Delta }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-[13px] font-bold",
        delta.direction === "up" && "bg-primary/10 text-primary",
        delta.direction === "down" && "bg-destructive/10 text-destructive",
        delta.direction === "flat" && "bg-muted text-muted-foreground",
      )}
    >
      {delta.text ?? "—"}
    </span>
  );
}

const th = "whitespace-nowrap pb-2 text-right text-xs font-semibold text-muted-foreground";
const td = "whitespace-nowrap border-t border-border py-3 text-right";

function ImpactTable({ impact }: { impact: OrderImpactData }) {
  const { window: w, baseline: b } = impact;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm tabular-nums">
        <colgroup>
          <col />
          <col className="w-[22%]" />
          <col className="w-[22%]" />
          <col className="w-24" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={cn(th, "text-left")}>
              Chỉ số
            </th>
            <th scope="col" className={th}>
              Trước khi chạy
              <br />
              <span className="font-normal">
                {formatShortDate(b.from)} – {formatShortDate(b.to)}
              </span>
            </th>
            <th scope="col" className={th}>
              Khi sàn chạy
              <br />
              <span className="font-normal">
                {formatShortDate(w.from)} – {w.running ? "nay" : formatShortDate(w.to)}
              </span>
            </th>
            <th scope="col" className={th}>
              Thay đổi
            </th>
          </tr>
        </thead>
        <tbody>
          {impactMetrics(impact).map((m) => (
            <tr key={m.key}>
              <th scope="row" className="whitespace-normal border-t border-border py-3 text-left font-normal">
                <span className="block font-semibold text-foreground">{m.label}</span>
                <span className="text-[12.5px] text-muted-foreground">{m.hint}</span>
              </th>
              <td className={cn(td, "text-muted-foreground")}>{formatCount(m.previous)}</td>
              <td className={cn(td, "text-[17px] font-bold text-foreground")}>{formatCount(m.current)}</td>
              <td className={td}>
                <DeltaPill delta={m.delta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface OrderImpactProps {
  impact: OrderImpactData | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** Tác động lên tài sản: 4 chỉ số trước / khi sàn chạy (cùng độ dài) + lượt xem theo ngày. */
export function OrderImpact({ impact, isLoading, isError }: OrderImpactProps) {
  const days = impact ? windowDays(impact) : 0;
  return (
    <SectionCard
      title="Tác động lên tài sản"
      actions={
        impact && (
          <span className="text-[13px] tabular-nums text-muted-foreground">
            {days} ngày trước vs. {days} ngày sàn chạy
          </span>
        )
      }
    >
      {isLoading ? (
        <Skeleton className="h-60 w-full rounded-xl" />
      ) : impact ? (
        <>
          <ImpactTable impact={impact} />
          {impact.daily.length > 0 && <OrderViewsBars impact={impact} />}
          <p className="text-[13.5px] text-muted-foreground">Không tính lượt xem và lưu tin của thành viên trong đơn vị bạn.</p>
        </>
      ) : (
        <p className="text-[13.5px] text-muted-foreground">
          {isError ? "Chưa tải được số liệu tài sản." : "Chưa có số liệu cho tài sản này."}
        </p>
      )}
    </SectionCard>
  );
}
