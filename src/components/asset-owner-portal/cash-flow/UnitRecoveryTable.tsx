import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { UnitRecovery } from "@/lib/ownerCashFlow";
import { formatMoneyShort } from "@/utils/money";

const GRID = "md:grid md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] md:items-center md:gap-4";

/** "Theo đơn vị" của Tháp Điều Hành — cùng tập tài sản bán trong kỳ với hero và thác tiền. */
export function UnitRecoveryTable({ units }: { units: UnitRecovery[] }) {
  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Đơn vị</span>
        <span className="text-right">Thực nhận</span>
        <span className="text-right">Còn phải thu</span>
        <span className="text-right">Quá hạn</span>
        <span className="text-right">Tỷ lệ thu</span>
      </div>
      <ul className="divide-y">
        {units.map((u) => (
          <li key={u.unit.id} className={cn("grid grid-cols-2 gap-x-4 gap-y-1 py-3", GRID)}>
            <p className="col-span-2 font-medium text-foreground md:col-span-1">
              {u.unit.name}
              {u.unit.isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">trụ sở</span>}
            </p>
            <Cell label="Thực nhận" strong>
              {u.totals.count ? formatMoneyShort(u.totals.net) : "—"}
            </Cell>
            <Cell label="Còn phải thu">{u.totals.count ? formatMoneyShort(u.totals.awaiting) : "—"}</Cell>
            <Cell label="Quá hạn" note={u.overdueCount ? `${u.overdueCount} tài sản` : undefined}>
              {u.overdue > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  {formatMoneyShort(u.overdue)}
                </span>
              ) : (
                "0"
              )}
            </Cell>
            <Cell label="Tỷ lệ thu">{u.rate === null ? "—" : `${Math.round(u.rate * 100)}%`}</Cell>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cell({
  label,
  strong,
  note,
  children,
}: {
  label: string;
  strong?: boolean;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("tabular-nums text-foreground md:text-right", strong && "font-semibold")}>
      <span className="block text-xs font-normal text-muted-foreground md:hidden">{label}</span>
      {children}
      {note && <span className="block text-[11px] font-normal text-muted-foreground">{note}</span>}
    </div>
  );
}
