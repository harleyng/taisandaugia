// Kết xuất dự thảo hợp đồng mua bán tài sản đấu giá ra PDF.
// Nạp ĐỘNG từ hook (pdfmake + font ~2MB) — chỉ khi tổ chức bấm "Tạo dự thảo".

import { loadPdfMake } from "@/lib/pdf/pdfmakeRuntime";
import { buildSaleDocDefinition } from "./document";
import type { SalePdfInput } from "./input";

export async function salePdfBlob(input: SalePdfInput): Promise<Blob> {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(buildSaleDocDefinition(input)).getBlob();
}

export { buildSalePdfInput, saleDraftFileName } from "./input";
export type { SalePdfInput } from "./input";
export { HDMB_TEMPLATE_VERSION } from "./clauses";
