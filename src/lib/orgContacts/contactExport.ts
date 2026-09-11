// Xuất danh bạ khách hàng ra Excel. Cột đầu khớp file mẫu import để tổ chức sửa
// rồi import lại được (dòng nhu cầu đầu tiên nằm ở các cột nhu cầu; các dòng
// còn lại gộp vào cột tóm tắt).

import * as XLSX from "xlsx-js-style";
import { CONTACT_TEMPLATE_HEADERS } from "./contactImport";
import { categoryLabel, interestSummary } from "./interestLabel";
import type { OrgContactListRow } from "@/types/org-contacts";

export function exportContactsXlsx(rows: OrgContactListRow[], groupName: (id: string) => string | undefined) {
  const header = ["Mã", ...CONTACT_TEMPLATE_HEADERS, "Trạng thái", "Mọi nhu cầu (tóm tắt)"];
  const body = rows.map((c) => {
    const first = c.org_contact_interests[0];
    return [
      c.code,
      c.full_name,
      c.contact_type === "company" ? "tổ chức" : "cá nhân",
      c.company_name ?? "",
      c.phone ?? "",
      c.email ?? "",
      c.zalo ?? "",
      c.province ?? "",
      c.notifications_enabled ? "có" : "không",
      first ? first.categories.map(categoryLabel).join(", ") : "",
      first ? first.provinces.join(", ") : "",
      first?.price_min ?? "",
      first?.price_max ?? "",
      c.group_ids.map(groupName).filter(Boolean).join(", "),
      c.note ?? "",
      c.status === "active" ? "Đang theo dõi" : "Ngừng theo dõi",
      c.org_contact_interests.map(interestSummary).join(" | "),
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 6)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Khách hàng");
  XLSX.writeFile(wb, "danh-ba-khach-hang.xlsx");
}
