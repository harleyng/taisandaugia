import { describe, expect, it } from "vitest";
import { formatVnd } from "@/lib/advertising/slug";
import { extractCaseDocument, type CaseExtractionInput } from "./caseExtraction";
import { formatVnDateTime } from "./formatVn";
import { UPLOADABLE_DOC_TYPES } from "./labels";
import { hasPlaceholder } from "./placeholders";
import { isCaseTopic } from "./topics";
import { LOTS, SESSION } from "./testFixtures";

const input = (over: Partial<CaseExtractionInput> = {}): CaseExtractionInput => ({
  documentId: "doc-1",
  docType: "deposit_terms",
  session: SESSION,
  orgName: "Công ty Đấu giá Thử",
  lots: LOTS,
  ...over,
});

const byHeading = (docType: CaseExtractionInput["docType"], heading: string, over: Partial<CaseExtractionInput> = {}) =>
  extractCaseDocument(input({ docType, ...over })).clauses.find((c) => c.heading === heading)!;

describe("extractCaseDocument", () => {
  it("tất định", () => {
    for (const docType of UPLOADABLE_DOC_TYPES) {
      expect(extractCaseDocument(input({ docType }))).toEqual(extractCaseDocument(input({ docType })));
    }
  });

  it("điền đúng số liệu thật của phiên", () => {
    const depositClause = byHeading("deposit_terms", "Khoản tiền đặt trước");
    expect(depositClause.body).toContain(formatVnd(250000000));
    expect(depositClause.body).toContain(formatVnd(180000000));
    expect(byHeading("rules", "Bước giá").body).toContain(formatVnd(50000000));
    expect(byHeading("notice", "Tiền mua hồ sơ tham gia đấu giá").body).toContain(formatVnd(500000));
    expect(byHeading("notice", "Thời gian tổ chức cuộc đấu giá").body).toContain(formatVnDateTime(SESSION.starts_at!));
  });

  it("ngày giờ ghim múi giờ Việt Nam", () => {
    expect(formatVnDateTime("2026-10-20T02:00:00Z")).toBe("09:00 ngày 20/10/2026");
    expect(formatVnDateTime("2026-10-15T17:30:00Z")).toBe("00:30 ngày 16/10/2026");
  });

  it("thiếu lịch xem tài sản ⇒ chỗ trống + cảnh báo, không bịa ngày", () => {
    const session: CaseExtractionInput["session"] = { ...SESSION, viewing_start_at: null, viewing_end_at: null };
    const result = extractCaseDocument(input({ docType: "viewing_schedule", session }));
    const clause = result.clauses[0];
    expect(hasPlaceholder(clause.body)).toBe(true);
    expect(clause.body).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result.warnings.some((w) => w.includes("xem tài sản"))).toBe(true);
  });

  it("thiếu tiền đặt trước một lô ⇒ chỗ trống đúng lô đó", () => {
    const lots = [LOTS[0], { ...LOTS[1], deposit_amount: null }];
    const body = byHeading("deposit_terms", "Khoản tiền đặt trước", { lots }).body;
    expect(body).toContain(formatVnd(250000000));
    expect(body).toContain("[[CẦN NHẬP: tiền đặt trước lô 2]]");
  });

  it("điều khoản chỉ tài liệu gốc mới có thì luôn để trống", () => {
    for (const [docType, heading] of [
      ["deposit_terms", "Phương thức nộp tiền đặt trước"],
      ["deposit_terms", "Hoàn trả tiền đặt trước"],
      ["rules", "Đối tượng được tham gia đấu giá"],
      ["rules", "Hồ sơ đăng ký tham gia đấu giá"],
    ] as const) {
      expect(hasPlaceholder(byHeading(docType, heading).body), heading).toBe(true);
    }
  });

  it("khuôn hợp lệ với ràng buộc DB", () => {
    for (const docType of UPLOADABLE_DOC_TYPES) {
      const { clauses } = extractCaseDocument(input({ docType }));
      expect(clauses.length).toBeGreaterThan(0);
      for (const c of clauses) {
        expect(c.clause_ref.length).toBeLessThanOrEqual(40);
        expect(c.body.length).toBeGreaterThanOrEqual(10);
        expect(c.body.length).toBeLessThanOrEqual(4000);
        expect(c.topics.length).toBeLessThanOrEqual(6);
        for (const t of c.topics) expect(isCaseTopic(t), t).toBe(true);
      }
    }
  });
});
