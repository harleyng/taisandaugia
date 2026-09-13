// Kết xuất biên bản đấu giá ra PDF.
//
// Nạp ĐỘNG từ thẻ phát hành (pdfmake + font ~2MB) — chỉ khi đấu giá viên bấm
// "Tạo biên bản", không gánh vào bundle của mọi trang phiên.

import { loadPdfMake } from "@/lib/pdf/pdfmakeRuntime";
import { buildMinutesDocDefinition } from "./document";
import type { MinutesPdfInput } from "./input";

export async function minutesPdfBlob(input: MinutesPdfInput): Promise<Blob> {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(buildMinutesDocDefinition(input)).getBlob();
}

export { buildMinutesDocDefinition } from "./document";
export {
  buildMinutesPdfInput,
  minutesFileName,
  minutesObjectPath,
  MINUTES_BUCKET,
  type MinutesPdfInput,
} from "./input";
export { sha256Hex } from "./hash";
