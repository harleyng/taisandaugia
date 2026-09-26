import { cn } from "@/lib/utils";
import type { UnitCashSummary } from "@/lib/ownerCashFlow";
import { formatMoneyFull } from "@/utils/money";

const GRID =
  "md:grid md:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] md:items-center md:gap-4";

/** L4 của Tháp Điều Hành: mỗi đơn vị một dòng — kỳ đang chọn + tình hình tới hôm nay. */
export function UnitBreakdownTable({ units }: { units: UnitCashSummary[] }) {
  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Đơn vị</span>
        <span className="text-right">Đã thu trong kỳ</span>
        <span className="text-right">Phí & hoàn trả</span>
        <span className="text-right">Thực nhận</span>
        <span className="text-right">Còn phải thu</span>
        <span className="text-right">Quá hạn</span>
      </div>
      <ul className="divide-y">
        {units.map((u) => (
          <li key={u.unit.id} className={cn("grid grid-cols-2 gap-x-4 gap-y-1 py-3", GRID)}>
            <p className="col-span-2 font-medium text-foreground md:col-span-1">
              {u.unit.name}
              {u.unit.isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">trụ sở</span>}
            </p>
            <Cell label="Đã thu" value={u.period.inflow} />
            <Cell label="Phí & hoàn trả" value={u.period.fees + u.period.refunds} muted />
            <Cell label="Thực nhận" value={u.period.net} strong />
            <Cell label="Còn phải thu" value={u.owed} />
            <Cell label="Quá hạn" value={u.overdue} note={u.overdueCount ? `${u.overdueCount} tài sản` : undefined} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cell({ label, value, muted, strong, note }: { label: string; value: number; muted?: boolean; strong?: boolean; note?: string }) {
  return (
    <p className={cn("tabular-nums md:text-right", muted ? "text-muted-foreground" : "text-foreground", strong && "font-medium")}>
      <span className="block text-xs text-muted-foreground md:hidden">{label}</span>
      {formatMoneyFull(value)}
      {note && <span className="block text-[11px] text-muted-foreground">{note}</span>}
    </p>
  );
}
