import { formatMoneyShort } from "@/utils/money";
import type { ReportPayload } from "@/lib/ownerPeriodicReport";
import { reportBranchRows } from "@/lib/ownerReportDigest";

/** "Theo chi nhánh" — chỉ báo cáo cả đơn vị có chi nhánh; không có thì không hiện thẻ. */
export function ReportBranchTable({ payload }: { payload: ReportPayload }) {
  const rows = reportBranchRows(payload);
  if (!rows.length) return null;

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl bg-card px-5 py-[18px] shadow-card">
      <h3 className="text-[15px] font-semibold text-foreground">Theo chi nhánh</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-[13.5px] tabular-nums">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="whitespace-nowrap pb-2 pr-2.5 font-medium">Chi nhánh</th>
              <th className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">Giá trúng</th>
              <th className="whitespace-nowrap px-2.5 pb-2 text-right font-medium">Đấu thành</th>
              <th className="whitespace-nowrap pb-2 pl-2.5 text-right font-medium">Tỷ lệ thu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.branchName} className="border-b last:border-0">
                <td className="py-2.5 pr-2.5 font-semibold text-foreground">{r.branchName}</td>
                <td className="px-2.5 py-2.5 text-right font-semibold">{formatMoneyShort(r.soldValue)}</td>
                <td className="px-2.5 py-2.5 text-right">
                  {r.sold} / {r.total}
                </td>
                <td className="py-2.5 pl-2.5 text-right">{r.collectRate !== null ? `${r.collectRate}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
