// Phiếu dự phiên ra PDF (A6) — nút "Tải phiếu (PDF)" trong dialog phiếu.
// Nạp ĐỘNG pdfmake (~2MB font) chỉ khi người mua bấm tải; QR dựng bằng nút `qr`
// có sẵn của pdfmake (cùng nội dung checkin_token với mã trên màn hình).

import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { loadPdfMake } from "@/lib/pdf/pdfmakeRuntime";
import type { TicketInfo } from "./attendanceTicket";

const GREEN = "#1b6b45";
const MUTED = "#64748b";

export function buildTicketDocDefinition(t: TicketInfo, checklist: string[]): TDocumentDefinitions {
  const rows: [string, Content][] = [
    ["Người dự phiên", t.attendee],
    ...(t.registrant ? ([["Người đăng ký", t.registrant]] as [string, Content][]) : []),
    ["Mã hồ sơ", t.contractCode],
    ...(t.lots ? ([["Tài sản", t.lots]] as [string, Content][]) : []),
    ["Điểm danh", t.window],
    ["Địa điểm", t.venue || "Tổ chức đấu giá sẽ thông báo"],
    ["Số báo danh", t.bidderNo ? { text: t.bidderNo, bold: true, color: GREEN } : "Cấp ngẫu nhiên khi điểm danh"],
  ];

  return {
    pageSize: "A6",
    pageMargins: [20, 20, 20, 20],
    info: { title: `Phiếu dự phiên ${t.contractCode}` },
    defaultStyle: { font: "Roboto", fontSize: 8.5, lineHeight: 1.2 },
    content: [
      { text: "PHIẾU DỰ PHIÊN", bold: true, fontSize: 12, color: GREEN, alignment: "center" },
      {
        text: [t.sessionCode ? `${t.sessionCode} · ` : "", "đấu giá trực tiếp"].join(""),
        color: MUTED,
        alignment: "center",
        margin: [0, 2, 0, 0],
      },
      { text: t.sessionTitle, alignment: "center", bold: true, margin: [0, 4, 0, 8] },
      { qr: t.token, fit: 120, alignment: "center", eccLevel: "M" },
      {
        text: "Đưa mã này cho nhân viên tại bàn điểm danh",
        color: MUTED,
        fontSize: 7.5,
        alignment: "center",
        margin: [0, 4, 0, 8],
      },
      {
        table: {
          widths: ["auto", "*"],
          body: rows.map(([k, v]) => [{ text: k, color: MUTED }, v]),
        },
        layout: {
          hLineWidth: (i: number) => (i === 0 ? 0.5 : 0),
          vLineWidth: () => 0,
          hLineColor: () => "#cbd5e1",
          hLineStyle: () => ({ dash: { length: 2 } }),
          paddingTop: (i: number) => (i === 0 ? 6 : 2),
          paddingBottom: () => 2,
          paddingLeft: () => 0,
          paddingRight: () => 8,
        },
      },
      { ul: checklist, margin: [0, 8, 0, 0], fontSize: 7.5, color: "#334155" },
    ],
  };
}

export async function ticketPdfBlob(t: TicketInfo, checklist: string[]): Promise<Blob> {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(buildTicketDocDefinition(t, checklist)).getBlob();
}
