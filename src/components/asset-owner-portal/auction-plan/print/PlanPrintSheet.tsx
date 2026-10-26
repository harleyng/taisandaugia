import logo from "@/assets/logo.png";
import { AUCTION_PLAN_KIND_LABELS, auctionPlanAutoTitle, type AuctionPlan } from "@/lib/auctionPlan/types";
import { formalDateLine, formatPlanDate, planPrintTitle, type PlanPrintSource } from "@/lib/auctionPlan/print";
import { PlanPrintTable } from "./PlanPrintTable";

// A4 NGANG (§A9) — bảng bảy cột không vừa trang dọc.
//
// ⚠️ "Bản in không cắt đôi dòng" là yêu cầu nghiệm thu, nên luật ngắt trang khai
// ở ba chỗ bổ trợ nhau: `break-inside: avoid` cho mọi `tr` (tên cũ
// `page-break-inside` cho engine cũ), `thead` là `table-header-group` để tiêu đề
// lặp mỗi trang, và khối tiêu đề / chữ ký cũng không bị cắt.
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
  tfoot { display: table-footer-group; }
  tr, td, th { page-break-inside: avoid; break-inside: avoid; }
}
`;

interface PlanPrintSheetProps {
  plan: AuctionPlan;
  source: PlanPrintSource;
  /** "Toàn đơn vị" hoặc tên chi nhánh — tên đơn vị lập kế hoạch. */
  unitLabel: string;
  /** "Xã Tân Dĩnh, Tỉnh Bắc Ninh" — đơn vị hành chính của kế hoạch. */
  adminUnitLabel: string | null;
  /** Ngày in (ISO) cho dòng cuối văn bản. */
  today: string;
}

/**
 * Tờ in theo mẫu quen thuộc: Quốc hiệu + tên đơn vị, tiêu đề danh mục, căn cứ
 * quyết định (khi đã duyệt), bảng bảy cột, rồi khối chữ ký ĐỂ TRỐNG.
 *
 * Quyết định D5: ứng dụng KHÔNG ký — khối chữ ký in trống để lãnh đạo ký tay.
 */
export function PlanPrintSheet({ plan, source, unitLabel, adminUnitLabel, today }: PlanPrintSheetProps) {
  const { rows, totals, baseline, isDraft } = source;
  const unitName = adminUnitLabel || unitLabel;
  const planName = plan.title?.trim() || auctionPlanAutoTitle(plan.plan_year, unitName);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <main className="mx-auto max-w-[297mm] space-y-4 px-4 py-8 text-foreground print:max-w-none print:p-0">
        <header className="break-inside-avoid space-y-4">
          <div className="grid grid-cols-2 gap-6 text-center text-[12px]">
            <div className="space-y-0.5">
              <p className="font-semibold uppercase">{unitName}</p>
              <span className="mx-auto block h-px w-24 bg-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">Số: ………/KH</p>
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold uppercase">Cộng hoà xã hội chủ nghĩa Việt Nam</p>
              <p className="font-semibold">Độc lập – Tự do – Hạnh phúc</p>
              <span className="mx-auto block h-px w-40 bg-foreground" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-1 text-center">
            <h1 className="text-base font-semibold uppercase tracking-tight">{planPrintTitle(plan, rows)}</h1>
            <p className="text-[12px]">{planName}</p>
            {baseline ? (
              <p className="text-[12px]">
                (Kèm theo Quyết định số {baseline.approval_doc_no || "………"}{" "}
                {baseline.approval_doc_date ? formalDateLine(baseline.approval_doc_date) : "ngày …… tháng …… năm ……"} ·
                bản mốc v{baseline.version})
              </p>
            ) : (
              <p className="text-[12px] font-semibold uppercase text-destructive">Bản dự thảo — chưa được phê duyệt</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {AUCTION_PLAN_KIND_LABELS[plan.kind]} · đơn vị lập: {unitLabel}
              {isDraft && plan.status === "adjusting" ? " · đang điều chỉnh" : ""}
              {totals.withoutMonth > 0 ? ` · ${totals.withoutMonth} tài sản chưa có thời gian dự kiến` : ""}
            </p>
          </div>
        </header>

        <PlanPrintTable rows={rows} totals={totals} />

        <section className="break-inside-avoid pt-2">
          <p className="text-right text-[12px] italic">
            {unitName}, {formalDateLine(baseline?.approval_doc_date ?? today) || `in ngày ${formatPlanDate(today)}`}
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
          <span>
            Lập từ Trạm Điều Hành · in ngày {formatPlanDate(today)}
            {baseline ? ` · nguồn: bản mốc v${baseline.version} (đã đóng băng)` : " · nguồn: danh mục đang soạn"}
          </span>
          <img src={logo} alt="taisandaugia" className="h-5 w-auto shrink-0" />
        </footer>
      </main>
    </>
  );
}
