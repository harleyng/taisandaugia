// "Xuất Excel" của Nhật ký hoạt động — đúng tập dòng của bộ lọc đang chọn (tối đa 5,000).
// Một dòng / thao tác; cột "Chi tiết" gom diff thành "Trường: trước → sau" mỗi dòng.

import * as XLSX from "xlsx-js-style";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTOR_KIND_LABELS,
  auditChangeRows,
  auditEntityTypeLabel,
  auditModuleLabel,
  auditSessionRows,
  auditSummary,
  formatAuditDateTime,
  type AuditEntry,
} from "@/lib/ownerAudit";

export const AUDIT_EXPORT_HEADERS = [
  "Thời gian",
  "Người thực hiện",
  "Vai",
  "Thao tác",
  "Mô tả",
  "Module",
  "Loại dữ liệu",
  "Đối tượng",
  "Chi nhánh",
  "Chi tiết",
  "Trang",
] as const;

// Cùng kiểu tiêu đề cột với file Dòng tiền (ownerCashFlowExcel).
const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "1F2937" } },
  fill: { patternType: "solid", fgColor: { rgb: "E5F2EC" } },
  border: { bottom: { style: "thin", color: { rgb: "1F2937" } } },
};

export function auditExportRow(e: AuditEntry): string[] {
  const detail = [
    ...auditChangeRows(e).map((r) =>
      e.action === "create" ? `${r.label}: ${r.after}` : e.action === "delete" ? `${r.label}: ${r.before}` : `${r.label}: ${r.before} → ${r.after}`,
    ),
    ...auditSessionRows(e).map((r) => `${r.label}: ${r.value}`),
  ].join("\n");
  return [
    formatAuditDateTime(e.created_at),
    e.actor_label,
    AUDIT_ACTOR_KIND_LABELS[e.actor_kind],
    AUDIT_ACTION_LABELS[e.action],
    auditSummary(e),
    auditModuleLabel(e.module),
    auditEntityTypeLabel(e.entity_type),
    e.entity_label ?? "",
    e.branch_name ?? "",
    detail,
    e.path ?? "",
  ];
}

export function buildAuditWorkbook(rows: AuditEntry[], meta: { scopeName: string; filterNote: string }): XLSX.WorkBook {
  const aoa: string[][] = [
    [`Nhật ký hoạt động — ${meta.scopeName}`],
    [meta.filterNote],
    [],
    [...AUDIT_EXPORT_HEADERS],
    ...rows.map(auditExportRow),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [16, 22, 12, 11, 34, 18, 20, 36, 20, 60, 36].map((wch) => ({ wch }));
  ws["A1"].s = { font: { bold: true, sz: 13 } };
  AUDIT_EXPORT_HEADERS.forEach((_, i) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 3, c: i })];
    if (cell) cell.s = HEADER_STYLE;
  });
  rows.forEach((_, i) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 4 + i, c: 9 })];
    if (cell) cell.s = { alignment: { wrapText: true, vertical: "top" } };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Nhật ký");
  return wb;
}

export function downloadAuditXlsx(rows: AuditEntry[], meta: { scopeName: string; filterNote: string }, fileName: string) {
  XLSX.writeFile(buildAuditWorkbook(rows, meta), fileName);
}
