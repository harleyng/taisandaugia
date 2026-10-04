// Xuất Excel cho báo cáo định kỳ (docs/owner-control-tower-plan.md Phase 10).
// Cùng cấu trúc với trang in: "Tổng quan" (các phần của §A5 + Hiệu quả truyền thông) + 5 sheet chi tiết.
// Tiền là SỐ (định dạng #,##0 — nhóm nghìn bằng dấu phẩy) để trụ sở cộng / lọc được;
// mọi dòng mang cột "Nguồn" (§A3). Không có cột id nào.

import * as XLSX from "xlsx-js-style";
import { OUTCOME_CONFIDENCE_META, OUTCOME_KIND_LABEL, type OutcomeConfidence } from "@/lib/ownerOutcomes";
import { TARGET_PERIOD_LABEL, periodLabel } from "@/lib/ownerTargets";
import {
  REPORT_PAYMENT_LABEL,
  formatReportDay,
  reportScopeLabel,
  reportTitle,
  type ReportPayload,
} from "@/lib/ownerPeriodicReport";
import {
  assetPriceRatioPct,
  FUNNEL_SOURCE_LABEL,
  funnelChannelLabel,
  funnelStages,
  priceRatioPct,
  UNATTRIBUTED_LABEL,
} from "@/lib/ownerMarketing/funnel";

export const REPORT_SHEETS = ["Tổng quan", "Kết quả phiên", "Tiền thu", "Tồn đọng", "Kế hoạch kỳ tới", "Truyền thông"] as const;

type Cell = string | number | null;

const MONEY_FORMAT = "#,##0";

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "1F2937" } },
  fill: { patternType: "solid", fgColor: { rgb: "E5F2EC" } },
  border: { bottom: { style: "thin", color: { rgb: "1F2937" } } },
  alignment: { vertical: "center", wrapText: true },
};
const TITLE_STYLE = { font: { bold: true, sz: 14, color: { rgb: "14532D" } } };
const SECTION_STYLE = { font: { bold: true, sz: 12, color: { rgb: "14532D" } } };
const LABEL_STYLE = { font: { color: { rgb: "4B5563" } } };

const sourceLabel = (c: OutcomeConfidence | null) => (c ? OUTCOME_CONFIDENCE_META[c].label : "");
const day = (iso: string | null) => (iso ? formatReportDay(iso) : "");
const money = (n: number | null) => (n === null ? null : Math.round(n));

interface Column {
  label: string;
  /** Chỉ dùng ở sheet bảng; sheet "Tổng quan" đặt độ rộng chung. */
  width?: number;
  money?: boolean;
}

function setStyle(ws: XLSX.WorkSheet, r: number, c: number, style: object) {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (ws[ref]) (ws[ref] as XLSX.CellObject).s = style;
}

function setMoney(ws: XLSX.WorkSheet, r: number, c: number) {
  const ref = XLSX.utils.encode_cell({ r, c });
  const cell = ws[ref] as XLSX.CellObject | undefined;
  if (cell && cell.t === "n") cell.z = MONEY_FORMAT;
}

/** Sheet bảng: một dòng tiêu đề + các dòng dữ liệu; cột tiền định dạng số. */
function tableSheet(columns: Column[], rows: Cell[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.label), ...rows]);
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 14 }));
  columns.forEach((col, c) => {
    setStyle(ws, 0, c, HEADER_STYLE);
    if (col.money) rows.forEach((_, i) => setMoney(ws, i + 1, c));
  });
  return ws;
}

/**
 * Sheet "Tổng quan": các khối nhãn–giá trị và bảng nhỏ nối tiếp nhau.
 * Ghi lại vị trí tiêu đề / dòng tiền để tô sau khi dựng sheet.
 */
class SummaryBuilder {
  rows: Cell[][] = [];
  private titles: number[] = [];
  private sections: number[] = [];
  private headers: number[] = [];
  private labels: number[] = [];
  private moneyCells: [number, number][] = [];

  title(text: string) {
    this.titles.push(this.rows.length);
    this.rows.push([text]);
  }
  section(text: string) {
    if (this.rows.length) this.rows.push([]);
    this.sections.push(this.rows.length);
    this.rows.push([text]);
  }
  field(label: string, value: Cell, isMoney = false) {
    this.labels.push(this.rows.length);
    if (isMoney) this.moneyCells.push([this.rows.length, 1]);
    this.rows.push([label, value]);
  }
  table(columns: Column[], rows: Cell[][]) {
    this.headers.push(this.rows.length);
    this.rows.push(columns.map((c) => c.label));
    for (const row of rows) {
      columns.forEach((col, c) => col.money && this.moneyCells.push([this.rows.length, c]));
      this.rows.push(row);
    }
  }
  build(): XLSX.WorkSheet {
    const ws = XLSX.utils.aoa_to_sheet(this.rows);
    ws["!cols"] = [{ wch: 34 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
    const width = Math.max(...this.rows.map((r) => r.length), 1);
    this.titles.forEach((r) => setStyle(ws, r, 0, TITLE_STYLE));
    this.sections.forEach((r) => setStyle(ws, r, 0, SECTION_STYLE));
    this.labels.forEach((r) => setStyle(ws, r, 0, LABEL_STYLE));
    this.headers.forEach((r) => {
      for (let c = 0; c < width; c += 1) setStyle(ws, r, c, HEADER_STYLE);
    });
    this.moneyCells.forEach(([r, c]) => setMoney(ws, r, c));
    return ws;
  }
}

function summarySheet(p: ReportPayload, status: "draft" | "final"): XLSX.WorkSheet {
  const b = new SummaryBuilder();
  const { meta, results, money: m, stuck, plan } = p;
  const totals = results.totals;

  b.title(`${reportTitle(meta.period.type, meta.period.start)}${meta.unitName ? ` — ${meta.unitName}` : ""}`);
  b.field("Phạm vi", reportScopeLabel(meta.scope));
  b.field("Kỳ", `${day(meta.period.start)} – ${day(meta.period.end)}`);
  b.field("Tồn đọng, chờ thu, lịch sắp tới tính đến ngày", day(meta.asOf));
  b.field("Trạng thái", status === "final" ? `Đã chốt ${day(p.finalizedAt)}` : "Bản nháp — số liệu chưa chốt");
  b.field("Người lập", p.people.preparedBy ?? "");
  b.field("Người chốt", p.people.finalizedBy ?? "");

  b.section("1. Tiến độ chỉ tiêu");
  if (p.targets.length) {
    b.table(
      [
        { label: "Phạm vi" },
        { label: "Chỉ tiêu thu hồi (₫)", money: true },
        { label: "Đã thu (₫)", money: true },
        { label: "% chỉ tiêu tiền" },
        { label: "Chỉ tiêu số tài sản" },
        { label: "Tài sản đấu thành" },
        { label: "% chỉ tiêu tài sản" },
        { label: "Chờ thu (₫)", money: true },
      ],
      p.targets.map((t) => [
        t.scope === "unit" ? "Toàn đơn vị" : t.branchName ?? "Chi nhánh",
        money(t.targetAmount),
        money(t.collected),
        t.amountPct,
        t.targetCount,
        t.soldCount,
        t.countPct,
        money(t.awaiting),
      ]),
    );
  } else {
    b.field("Chỉ tiêu", `Chưa đặt chỉ tiêu cho ${periodLabel(meta.period.type, meta.period.start)}`);
  }

  b.section("2. Kết quả phiên trong kỳ");
  b.field("Tài sản có kết quả", totals.total);
  b.field("Thành", totals.sold);
  b.field("Không thành", totals.unsold);
  b.field("Hoãn / Huỷ / Rút", totals.voided);
  b.field("Tỷ lệ thành công (%)", totals.successRate);
  b.field("Tổng giá trúng (₫)", money(totals.soldValue), true);
  b.field("Tài sản đã bán chưa rõ giá trúng", totals.soldWithoutPrice);
  b.field("Người trúng bỏ cọc", totals.defaulted);
  b.field("Tài sản lệch số liệu giữa các nguồn", totals.conflicts);
  if (results.byLabel.length) {
    b.table(
      [
        { label: "Nguồn số liệu" },
        { label: "Số tài sản" },
        { label: "Thành" },
        { label: "Giá trúng (₫)", money: true },
      ],
      results.byLabel.map((g) => [sourceLabel(g.label), g.count, g.sold, money(g.soldValue)]),
    );
  }

  b.section("3. Tiền thu trong kỳ");
  b.field("Đã thu (₫)", money(m.collected), true);
  b.field("— đơn vị đã ghi nhận thu (₫)", money(m.recorded), true);
  b.field("— tạm tính theo giá trúng (₫)", money(m.estimated), true);
  b.field("Chờ thu (₫)", money(m.awaiting), true);
  b.field("Người trúng bỏ cọc — số tài sản", m.defaulted.count);
  b.field("Người trúng bỏ cọc — giá trúng (₫)", money(m.defaulted.value), true);
  b.field("Chờ thu từ các kỳ trước — số tài sản", m.carryOver.count);
  b.field("Chờ thu từ các kỳ trước (₫)", money(m.carryOver.awaiting), true);
  if (m.byLabel.length) {
    b.table(
      [
        { label: "Nguồn số liệu" },
        { label: "Số tài sản" },
        { label: "Đã thu (₫)", money: true },
        { label: "Chờ thu (₫)", money: true },
      ],
      m.byLabel.map((g) => [sourceLabel(g.label), g.count, money(g.collected), money(g.awaiting)]),
    );
  }

  b.section("4. Tài sản tồn đọng");
  b.field("Số tài sản tồn đọng", stuck.count);
  b.field(
    "Tiêu chí",
    `Chưa bán sau từ ${stuck.rule.minRounds} lượt đấu, hoặc đã hơn ${stuck.rule.maxDays} ngày kể từ lần đầu đưa ra đấu giá`,
  );

  b.section("5. Kế hoạch kỳ tới");
  if (plan.nextPeriod) {
    b.field("Kỳ tới", `${TARGET_PERIOD_LABEL[plan.nextPeriod.type]} ${day(plan.nextPeriod.start)} – ${day(plan.nextPeriod.end)}`);
  }
  for (const t of plan.nextTargets) {
    const scope = t.scope === "unit" ? "Toàn đơn vị" : t.branchName ?? "Chi nhánh";
    if (t.targetAmount !== null) b.field(`Chỉ tiêu thu hồi — ${scope} (₫)`, money(t.targetAmount), true);
    if (t.targetCount !== null) b.field(`Chỉ tiêu số tài sản — ${scope}`, t.targetCount);
  }
  b.field("Phiên đã lên lịch", plan.scheduled.length);
  b.field("Tài sản tồn đọng chưa có lịch đấu lại", plan.stuckUnscheduled);
  b.field("Kế hoạch của đơn vị", p.notes.plan ?? "");

  b.section("6. Hiệu quả truyền thông");
  const mk = p.marketing;
  if (!mk) {
    b.field("Ghi chú", "Báo cáo chốt trước khi có phần này");
  } else {
    b.field("Tài sản đang truyền thông", mk.totals.assets);
    for (const s of funnelStages(mk.totals)) b.field(s.label, s.value);
    const ratio = priceRatioPct(mk.totals);
    if (ratio !== null) b.field("Giá trúng / giá khởi điểm (%)", ratio);
    b.field(`Lượt lưu — ${UNATTRIBUTED_LABEL.toLowerCase()}`, mk.unattributed.saves);
    b.field(`Đăng ký — ${UNATTRIBUTED_LABEL.toLowerCase()}`, mk.unattributed.registrations);
    const breakdown = [
      ...mk.bySource.map((r) => [FUNNEL_SOURCE_LABEL[r.key], "Nguồn", r.sent, r.clicks, r.visitors, r.saves, r.registrations]),
      ...mk.byChannel.map((r) => [funnelChannelLabel(r), "Kênh", r.sent, r.clicks, r.visitors, r.saves, r.registrations]),
    ] as Cell[][];
    if (breakdown.length) {
      b.table(
        [{ label: "Nguồn / kênh" }, { label: "Loại" }, { label: "Gửi" }, { label: "Bấm" }, { label: "Xem" }, { label: "Lưu" }, { label: "Đăng ký" }],
        breakdown,
      );
    }
  }

  b.section("7. Ghi chú của cán bộ");
  b.field("Ghi chú", p.notes.officer ?? "");

  return b.build();
}

export function buildReportWorkbook(p: ReportPayload, status: "draft" | "final"): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet(p, status), REPORT_SHEETS[0]);

  XLSX.utils.book_append_sheet(
    wb,
    tableSheet(
      [
        { label: "Mã tài sản", width: 12 },
        { label: "Tài sản", width: 44 },
        { label: "Chi nhánh", width: 28 },
        { label: "Tổ chức đấu giá", width: 32 },
        { label: "Ngày đấu", width: 12 },
        { label: "Kết quả", width: 14 },
        { label: "Giá khởi điểm (₫)", width: 18, money: true },
        { label: "Giá trúng (₫)", width: 18, money: true },
        { label: "Thu tiền", width: 18 },
        { label: "Nguồn số liệu", width: 20 },
        { label: "Lệch số liệu", width: 12 },
      ],
      p.results.items.map((i) => [
        i.assetCode ?? "Ngoài sàn",
        i.title,
        i.branchName ?? "",
        i.orgName ?? "",
        day(i.date),
        i.outcome ? OUTCOME_KIND_LABEL[i.outcome] : "",
        money(i.startingPrice),
        money(i.price),
        i.paymentStatus ? REPORT_PAYMENT_LABEL[i.paymentStatus] : "",
        sourceLabel(i.confidence),
        i.hasConflict ? "Có" : "",
      ]),
    ),
    REPORT_SHEETS[1],
  );

  XLSX.utils.book_append_sheet(
    wb,
    tableSheet(
      [
        { label: "Mã tài sản", width: 12 },
        { label: "Tài sản", width: 44 },
        { label: "Chi nhánh", width: 28 },
        { label: "Ngày đấu", width: 12 },
        { label: "Giá trúng (₫)", width: 18, money: true },
        { label: "Đã thu (₫)", width: 18, money: true },
        { label: "Chờ thu (₫)", width: 18, money: true },
        { label: "Tình trạng", width: 20 },
        { label: "Nguồn số liệu", width: 20 },
      ],
      p.money.items.map((i) => [
        i.assetCode ?? "Ngoài sàn",
        i.title,
        i.branchName ?? "",
        day(i.date),
        money(i.price),
        money(i.paidAmount),
        money(i.awaiting),
        i.paymentStatus ? REPORT_PAYMENT_LABEL[i.paymentStatus] : "",
        sourceLabel(i.confidence),
      ]),
    ),
    REPORT_SHEETS[2],
  );

  XLSX.utils.book_append_sheet(
    wb,
    tableSheet(
      [
        { label: "Mã tài sản", width: 12 },
        { label: "Tài sản", width: 44 },
        { label: "Chi nhánh", width: 28 },
        { label: "Số lượt đấu", width: 12 },
        { label: "Số ngày", width: 10 },
        { label: "Lần đầu", width: 12 },
        { label: "Kết quả gần nhất", width: 18 },
        { label: "Ngày gần nhất", width: 14 },
        { label: "Giá khởi điểm (₫)", width: 18, money: true },
        { label: "Phiên tới", width: 12 },
        { label: "Nguồn số liệu", width: 20 },
      ],
      p.stuck.items.map((i) => [
        i.assetCode ?? "Ngoài sàn",
        i.title,
        i.branchName ?? "",
        i.rounds,
        i.ageDays,
        day(i.firstDate),
        i.lastOutcome ? OUTCOME_KIND_LABEL[i.lastOutcome] : "Chưa có kết quả",
        day(i.lastDate),
        money(i.startingPrice),
        day(i.nextDate),
        sourceLabel(i.confidence),
      ]),
    ),
    REPORT_SHEETS[3],
  );

  XLSX.utils.book_append_sheet(
    wb,
    tableSheet(
      [
        { label: "Mã tài sản", width: 12 },
        { label: "Tài sản", width: 44 },
        { label: "Chi nhánh", width: 28 },
        { label: "Ngày đấu", width: 12 },
        { label: "Tổ chức đấu giá", width: 32 },
        { label: "Giá khởi điểm (₫)", width: 18, money: true },
        { label: "Lịch theo", width: 18 },
        { label: "Đang tồn đọng", width: 14 },
      ],
      p.plan.scheduled.map((i) => [
        i.assetCode ?? "Ngoài sàn",
        i.title,
        i.branchName ?? "",
        day(i.date),
        i.orgName ?? "",
        money(i.startingPrice),
        i.source === "platform" ? "Phiên trên sàn" : "Tin đăng",
        i.isStuck ? "Có" : "",
      ]),
    ),
    REPORT_SHEETS[4],
  );

  XLSX.utils.book_append_sheet(
    wb,
    tableSheet(
      [
        { label: "Mã tài sản", width: 12 },
        { label: "Tài sản", width: 44 },
        { label: "Chi nhánh", width: 28 },
        { label: "Gửi", width: 10 },
        { label: "Bấm", width: 10 },
        { label: "Xem", width: 10 },
        { label: "Lưu (qua link)", width: 14 },
        { label: "Lưu (không rõ nguồn)", width: 18 },
        { label: "Đăng ký (qua link)", width: 16 },
        { label: "Đăng ký (không rõ nguồn)", width: 22 },
        { label: "Người tham gia", width: 14 },
        { label: "Kết quả", width: 14 },
        { label: "Ngày", width: 12 },
        { label: "Giá trúng (₫)", width: 18, money: true },
        { label: "Giá trúng / KĐ (%)", width: 16 },
      ],
      (p.marketing?.byAsset ?? []).map((a) => [
        a.assetCode ?? "",
        a.title,
        a.branchName ?? "",
        a.sent,
        a.clicks,
        a.visitors,
        a.saves,
        a.savesUnattributed,
        a.registrations,
        a.registrationsUnattributed,
        a.participants,
        a.outcome ? OUTCOME_KIND_LABEL[a.outcome] : "",
        day(a.outcomeDate),
        money(a.outcome === "sold" ? a.price : null),
        assetPriceRatioPct(a),
      ]),
    ),
    REPORT_SHEETS[5],
  );

  return wb;
}

export function downloadReportXlsx(p: ReportPayload, status: "draft" | "final", fileName: string) {
  XLSX.writeFile(buildReportWorkbook(p, status), fileName);
}
