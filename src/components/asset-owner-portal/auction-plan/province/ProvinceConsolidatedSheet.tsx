import logo from "@/assets/logo.png";
import { PlanPrintTable } from "@/components/asset-owner-portal/auction-plan/print/PlanPrintTable";
import { formalDateLine, formatPlanDate } from "@/lib/auctionPlan/print";
import { AUCTION_PLAN_KIND_LABELS } from "@/lib/auctionPlan/types";
import { formatMoneyFull } from "@/utils/money";
import type { ConsolidatedUnit } from "@/lib/auctionPlan/consolidated";
import type { PlanTotals } from "@/lib/auctionPlan/totals";

// A4 NGANG như bản in của một kế hoạch (§A9) — bảng bảy cột không vừa trang dọc.
//
// ⚠️ "Không cắt đôi dòng khi in" vẫn là yêu cầu nghiệm thu, và ở đây có THÊM một
// luật: mỗi đơn vị hành chính là MỘT `<tbody>` riêng (Phase 4 khuyến nghị), nên
// `break-inside: avoid` của từng `tr` tiếp tục hiệu lực và tiêu đề bảng lặp lại
// ở mỗi trang giấy.
const PRINT_CSS = `
@page {
  size: A4 landscape;
  margin: 12mm 10mm 14mm;
  @bottom-left { content: "taisandaugia.vn"; font-size: 8pt; }
  @bottom-right { content: "Trang " counter(page) " / " counter(pages); font-size: 8pt; }
}
@media print {
  html, body { background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table { page-break-inside: auto; }
  thead { display: table-header-group; }
  tbody { page-break-inside: auto; }
  tr, td, th { page-break-inside: avoid; break-inside: avoid; }
}
`;

interface ProvinceConsolidatedSheetProps {
  provinceName: string;
  planYear: number;
  units: readonly ConsolidatedUnit[];
  totals: PlanTotals;
  today: string;
}

/**
 * Bản in tổng hợp toàn tỉnh: Quốc hiệu + tên tỉnh, bảng tóm tắt theo đơn vị, rồi
 * một bảng bảy cột cho MỖI đơn vị, và khối chữ ký ĐỂ TRỐNG (quyết định D5 — ứng
 * dụng không ký).
 */
export function ProvinceConsolidatedSheet({
  provinceName,
  planYear,
  units,
  totals,
  today,
}: ProvinceConsolidatedSheetProps) {
  return (
    <>
      <style>{PRINT_CSS}</style>
      <main className="mx-auto max-w-[297mm] space-y-5 px-4 py-8 text-foreground print:max-w-none print:p-0">
        <header className="break-inside-avoid space-y-4">
          <div className="grid grid-cols-2 gap-6 text-center text-[12px]">
            <div className="space-y-0.5">
              <p className="font-semibold uppercase">{provinceName}</p>
              <span className="mx-auto block h-px w-24 bg-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">Số: ………/BC</p>
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold uppercase">Cộng hoà xã hội chủ nghĩa Việt Nam</p>
              <p className="font-semibold">Độc lập – Tự do – Hạnh phúc</p>
              <span className="mx-auto block h-px w-40 bg-foreground" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-base font-semibold uppercase tracking-tight">
              Tổng hợp kế hoạch đấu giá toàn tỉnh năm {planYear}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Nguồn: bản mốc đã phê duyệt của {units.length} đơn vị · {totals.count} tài sản · giá trị khởi điểm
              dự kiến {formatMoneyFull(totals.expected)}
            </p>
          </div>
        </header>

        <section className="break-inside-avoid space-y-2">
          <h2 className="text-[13px] font-semibold uppercase">I. Tổng hợp theo đơn vị</h2>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th scope="col" className="w-[5%] border border-border px-1.5 py-1.5 text-center font-semibold">
                  STT
                </th>
                <th scope="col" className="border border-border px-1.5 py-1.5 text-left font-semibold">
                  Đơn vị
                </th>
                <th scope="col" className="border border-border px-1.5 py-1.5 text-right font-semibold">
                  Số tài sản
                </th>
                <th scope="col" className="border border-border px-1.5 py-1.5 text-right font-semibold">
                  Diện tích (m²)
                </th>
                <th scope="col" className="border border-border px-1.5 py-1.5 text-right font-semibold">
                  Giá trị khởi điểm dự kiến
                </th>
                <th scope="col" className="border border-border px-1.5 py-1.5 text-left font-semibold">
                  Căn cứ phê duyệt
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, index) => (
                <tr key={unit.code} className="break-inside-avoid align-top">
                  <td className="border border-border px-1.5 py-1 text-center tabular-nums">{index + 1}</td>
                  <td className="border border-border px-1.5 py-1">
                    {unit.unitName}
                    {unit.unitLevel === "province" && (
                      <span className="ml-1 text-muted-foreground">(cấp tỉnh)</span>
                    )}
                  </td>
                  <td className="border border-border px-1.5 py-1 text-right tabular-nums">{unit.totals.count}</td>
                  <td className="border border-border px-1.5 py-1 text-right tabular-nums">
                    {unit.totals.area > 0
                      ? unit.totals.area.toLocaleString("en-US", { maximumFractionDigits: 1 })
                      : "—"}
                  </td>
                  <td className="border border-border px-1.5 py-1 text-right tabular-nums">
                    {formatMoneyFull(unit.totals.expected)}
                  </td>
                  <td className="border border-border px-1.5 py-1">
                    {unit.plans
                      .map((p) =>
                        [
                          AUCTION_PLAN_KIND_LABELS[p.planKind],
                          p.approvalDocNo ? `QĐ ${p.approvalDocNo}` : null,
                          p.approvalDocDate ? formatPlanDate(p.approvalDocDate) : null,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      )
                      .join(" | ")}
                  </td>
                </tr>
              ))}
              <tr className="break-inside-avoid bg-muted/40 font-semibold">
                <td className="border border-border px-1.5 py-1.5 text-center" colSpan={2}>
                  Tổng cộng
                </td>
                <td className="border border-border px-1.5 py-1.5 text-right tabular-nums">{totals.count}</td>
                <td className="border border-border px-1.5 py-1.5 text-right tabular-nums">
                  {totals.area > 0 ? totals.area.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "—"}
                </td>
                <td className="border border-border px-1.5 py-1.5 text-right tabular-nums">
                  {formatMoneyFull(totals.expected)}
                </td>
                <td className="border border-border px-1.5 py-1.5" />
              </tr>
            </tbody>
          </table>
        </section>

        <section className="space-y-4">
          <h2 className="break-inside-avoid text-[13px] font-semibold uppercase">II. Danh mục chi tiết theo đơn vị</h2>
          {units.map((unit) => (
            <div key={unit.code} className="space-y-1.5">
              <h3 className="break-inside-avoid text-[12px] font-semibold">
                {unit.unitName} — {unit.totals.count} tài sản · {formatMoneyFull(unit.totals.expected)}
              </h3>
              <PlanPrintTable rows={unit.rows} totals={unit.totals} />
            </div>
          ))}
          {units.length === 0 && (
            <p className="text-[12px] text-muted-foreground">
              Năm {planYear} chưa có đơn vị nào được phê duyệt kế hoạch.
            </p>
          )}
        </section>

        <section className="break-inside-avoid pt-2">
          <p className="text-right text-[12px] italic">
            {provinceName}, {formalDateLine(today) || `in ngày ${formatPlanDate(today)}`}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-6 text-center text-[12px]">
            <div>
              <p className="font-semibold uppercase">Người lập biểu</p>
              <p className="text-muted-foreground">(Ký, ghi rõ họ tên)</p>
              <div className="h-20" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold uppercase">Thủ trưởng đơn vị</p>
              <p className="text-muted-foreground">(Ký, ghi rõ họ tên, đóng dấu)</p>
              <div className="h-20" aria-hidden="true" />
            </div>
          </div>
        </section>

        <footer className="flex break-inside-avoid items-center justify-between gap-4 border-t pt-3 text-[10px] text-muted-foreground">
          <span>Lập từ Trạm Điều Hành · in ngày {formatPlanDate(today)} · nguồn: bản mốc đã đóng băng</span>
          <img src={logo} alt="taisandaugia" className="h-5 w-auto shrink-0" />
        </footer>
      </main>
    </>
  );
}
