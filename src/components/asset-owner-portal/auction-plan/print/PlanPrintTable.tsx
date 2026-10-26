import { formatMoneyFull } from "@/utils/money";
import { PLAN_PRINT_COLUMNS, type PlanPrintRow } from "@/lib/auctionPlan/print";
import type { PlanTotals } from "@/lib/auctionPlan/totals";

const areaText = (area: number | null) =>
  area === null ? "—" : area.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** Giá đơn vị in đầy đủ, nhóm nghìn bằng DẤU PHẨY (luật tiền của dự án). */
const priceText = (price: number | null) => (price === null ? "—" : formatMoneyFull(price));

interface PlanPrintTableProps {
  rows: readonly PlanPrintRow[];
  totals: PlanTotals;
}

/**
 * Bảng bảy cột của biểu mẫu chính thức (§A9).
 *
 * ⚠️ IN KHÔNG ĐƯỢC CẮT ĐÔI DÒNG: mỗi `<tr>` mang `break-inside-avoid`
 * (+ `page-break-inside: avoid` cho engine cũ, khai trong `PlanPrintSheet`), và
 * `<thead>` là `table-header-group` nên tiêu đề lặp lại ở mỗi trang giấy.
 */
export function PlanPrintTable({ rows, totals }: PlanPrintTableProps) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr>
          {PLAN_PRINT_COLUMNS.map((label, i) => (
            <th
              key={label}
              scope="col"
              className={`border border-border px-1.5 py-1.5 align-middle font-semibold ${
                i === 0 ? "w-[4%] text-center" : i >= 3 && i !== 4 ? "text-right" : "text-left"
              }`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="break-inside-avoid align-top">
            <td className="border border-border px-1.5 py-1 text-center tabular-nums">{row.seq}</td>
            <td className="border border-border px-1.5 py-1">
              {row.title}
              <span className="ml-1 text-muted-foreground">({row.itemCode})</span>
            </td>
            <td className="border border-border px-1.5 py-1">{row.lotLabels}</td>
            <td className="border border-border px-1.5 py-1 text-right tabular-nums">{areaText(row.area)}</td>
            <td className="border border-border px-1.5 py-1">{row.location}</td>
            <td className="border border-border px-1.5 py-1 text-right tabular-nums">{priceText(row.unitPrice)}</td>
            <td className="border border-border px-1.5 py-1 whitespace-nowrap">{row.period}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr className="break-inside-avoid">
            <td className="border border-border px-1.5 py-3 text-center text-muted-foreground" colSpan={7}>
              Kế hoạch chưa có tài sản nào.
            </td>
          </tr>
        )}
        <tr className="break-inside-avoid bg-muted/40 font-semibold">
          <td className="border border-border px-1.5 py-1.5 text-center" colSpan={3}>
            Tổng cộng
          </td>
          <td className="border border-border px-1.5 py-1.5 text-right tabular-nums">
            {areaText(totals.area > 0 ? totals.area : null)}
          </td>
          <td className="border border-border px-1.5 py-1.5">
            {totals.count} tài sản · giá trị khởi điểm dự kiến {formatMoneyFull(totals.expected)}
          </td>
          <td className="border border-border px-1.5 py-1.5" />
          <td className="border border-border px-1.5 py-1.5" />
        </tr>
      </tbody>
    </table>
  );
}
