// Xuất danh sách NGƯỜI NHẬN của một phiên ra Excel để tổ chức tự gửi (Zalo/SMS/
// gọi). CHỈ xuất khách đủ điều kiện (đang theo dõi + đã đồng ý nhận tin) — khách
// chưa đồng ý không được lọt vào file gửi.

import * as XLSX from "xlsx-js-style";
import type { AudienceRow } from "@/types/org-contacts";

interface LotRef {
  id: string;
  lot_no: number;
  title: string;
}

export function audienceSheetRows(
  rows: AudienceRow[],
  lots: LotRef[],
  groupName: (id: string) => string | undefined,
): string[][] {
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const header = ["Mã khách", "Họ tên", "Công ty", "Điện thoại", "Zalo", "Email", "Lô khớp", "Nhóm"];
  const body = rows
    .filter((r) => r.eligible)
    .map((r) => [
      r.code,
      r.full_name,
      r.company_name ?? "",
      r.phone ?? "",
      r.zalo ?? "",
      r.email ?? "",
      r.matched_item_ids
        .map((id) => lotById.get(id))
        .filter((l): l is LotRef => !!l)
        .map((l) => `Lô ${l.lot_no}: ${l.title}`)
        .join("; "),
      r.group_ids.map(groupName).filter(Boolean).join(", "),
    ]);
  return [header, ...body];
}

export function exportAudienceXlsx(
  rows: AudienceRow[],
  lots: LotRef[],
  groupName: (id: string) => string | undefined,
  sessionCode: string,
) {
  const aoa = audienceSheetRows(rows, lots, groupName);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 40 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Người nhận");
  XLSX.writeFile(wb, `nguoi-nhan-${sessionCode}.xlsx`);
}
