// @vitest-environment node
// Dựng PDF THẬT cho cả 6 loại mẫu bằng dữ liệu giả — bắt lỗi cây pdfmake (kiểu
// bảng, font tiếng Việt) mà kiểm cây nội dung không thấy.
import { describe, expect, it } from "vitest";
import { TEMPLATE_TYPES } from "./schema";
import { templateSamplePdfBlob } from "./samplePdf";

describe("templateSamplePdfBlob — PDF thật cho mọi loại mẫu", () => {
  for (const def of TEMPLATE_TYPES) {
    it(`${def.type} ra được tệp PDF`, async () => {
      const clauses = def.type.startsWith("service:")
        ? { provider_name: "Công ty Sàn", scope: ["Phạm vi mẫu."], deliverables: "Kết quả mẫu.", effect: ["Hiệu lực."] }
        : {};
      const blob = await templateSamplePdfBlob(def.type, `${def.versionPrefix}-TEST`, clauses);
      const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
      expect(head).toBe("%PDF-");
    }, 20_000);
  }
});
