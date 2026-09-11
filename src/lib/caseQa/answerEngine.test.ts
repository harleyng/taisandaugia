import { describe, expect, it } from "vitest";
import type { CaseQaProposal, EngineClause } from "@/types/case-qa";
import { answerCaseQuestion, ENGINE_FLOOR, MAX_CITATIONS, MIN_QUOTE, splitSentences } from "./answerEngine";
import { composeAnswerText, snapshotCitations } from "./compose";
import { buildCaseFaq, faqCoverage } from "./coverage";
import { STANDARD_QUESTIONS } from "./standardQuestions";
import { buildFilledCase, SESSION } from "./testFixtures";

const CASE = buildFilledCase();
const ask = (question: string, clauses: readonly EngineClause[] = CASE, sessionCode = SESSION.code) =>
  answerCaseQuestion({ question, sessionCode, clauses });

/** Bất biến lõi: câu trả lời chỉ gồm trích dẫn nguyên văn từ điều khoản citable. */
function expectGrounded(p: CaseQaProposal, clauses: readonly EngineClause[]) {
  if (p.outcome !== "answer") return;
  expect(p.citations.length).toBeGreaterThanOrEqual(1);
  expect(p.citations.length).toBeLessThanOrEqual(MAX_CITATIONS);
  for (const cit of p.citations) {
    const clause = clauses.find((c) => c.clause_id === cit.clause_id);
    expect(clause, `clause ${cit.clause_id}`).toBeDefined();
    expect(clause!.citable).toBe(true);
    expect(clause!.body.includes(cit.quote)).toBe(true);
    expect(cit.quote.length).toBeGreaterThanOrEqual(MIN_QUOTE);
  }
}

const deposit = (over: Partial<EngineClause> = {}): EngineClause => ({
  clause_id: "c-deposit",
  document_id: "doc-deposit",
  doc_type: "deposit_terms",
  doc_title: "Điều kiện tiền đặt trước",
  clause_ref: "Khoản 1",
  heading: "Khoản tiền đặt trước",
  body: "Lô 1: tiền đặt trước 250,000,000₫.",
  topics: ["deposit"],
  sort_order: 10,
  citable: true,
  ...over,
});

describe("answerCaseQuestion — tất định", () => {
  it("cùng đầu vào ra cùng kết quả", () => {
    expect(ask("Tiền đặt trước là bao nhiêu?")).toEqual(ask("Tiền đặt trước là bao nhiêu?"));
  });

  it("có dấu và không dấu ra cùng trích dẫn", () => {
    expect(ask("tien dat truoc bao nhieu").citations).toEqual(ask("Tiền đặt trước bao nhiêu?").citations);
  });
});

describe("answerCaseQuestion — không bao giờ trả lời thiếu trích dẫn", () => {
  const PARAPHRASES = [
    "tien dat truoc bao nhieu",
    "Cho em hỏi tiền cọc bao nhiêu ạ?",
    "Đặt cọc bao nhiêu vậy shop",
    "Hạn chót đăng ký là khi nào?",
    "bước giá mỗi lần trả là bao nhiêu",
    "Mấy giờ đấu giá?",
    "Đấu giá ở đâu vậy?",
    "Khi nào được đi xem nhà?",
    "Chuyển khoản tiền cọc vào số tài khoản nào?",
    "Không trúng thì bao lâu được hoàn cọc?",
    "Cần chuẩn bị giấy tờ gì?",
    "Người khác đi thay có được không?",
    "gia khoi diem lo 2",
    "Tiền mua hồ sơ bao nhiêu?",
    "Đấu giá trực tuyến hay không?",
    "Phiên PDG000123 đặt cọc bao nhiêu?",
    "Chào shop!\nHạn nộp tiền đặt trước khi nào?",
    "Hạn đăng ký và tiền đặt trước bao nhiêu?",
  ];

  it("20 câu chuẩn đều trả lời được khi tài liệu đầy đủ", () => {
    for (const sq of STANDARD_QUESTIONS) {
      const p = ask(sq.question);
      expect(p.outcome, sq.question).toBe("answer");
      expect(p.topics, sq.question).toContain(sq.topic);
      expectGrounded(p, CASE);
    }
  });

  it("các cách hỏi khác vẫn trả lời, và luôn có trích dẫn hợp lệ", () => {
    for (const q of PARAPHRASES) {
      const p = ask(q);
      expect(p.outcome, q).toBe("answer");
      expectGrounded(p, CASE);
    }
  });

  it("mọi kết quả (kể cả câu linh tinh) đều thoả bất biến", () => {
    for (const q of [...PARAPHRASES, "ok", "???", "Có chỗ đậu xe không?", "tiền", "Lô 9 tiền đặt trước?"]) {
      expectGrounded(ask(q), CASE);
    }
  });

  it("độ tin cậy luôn trong [0,1] và câu trả lời không dưới ngưỡng engine", () => {
    for (const sq of STANDARD_QUESTIONS) {
      const p = ask(sq.question);
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
      if (p.outcome === "answer") expect(p.confidence).toBeGreaterThanOrEqual(ENGINE_FLOOR);
    }
  });
});

describe("answerCaseQuestion — chuyển người", () => {
  it("ngoài phạm vi: tư vấn / dự đoán", () => {
    expect(ask("Có nên mua căn này không?")).toMatchObject({ outcome: "escalate", reason: "out_of_scope" });
    expect(ask("Giá trúng dự kiến bao nhiêu?")).toMatchObject({ outcome: "escalate", reason: "out_of_scope" });
  });

  it("hỏi phiên khác dù có từ khoá tiền đặt trước", () => {
    expect(ask("Phiên PDG000999 đặt cọc bao nhiêu?")).toMatchObject({ outcome: "escalate", reason: "out_of_scope" });
  });

  it("chưa có tài liệu xác nhận", () => {
    expect(ask("Tiền đặt trước là bao nhiêu?", [])).toMatchObject({ outcome: "escalate", reason: "no_documents" });
    const drafts = CASE.map((c) => ({ ...c, citable: false }));
    expect(ask("Tiền đặt trước là bao nhiêu?", drafts)).toMatchObject({ outcome: "escalate", reason: "no_documents" });
  });

  it("tài liệu không nêu", () => {
    expect(ask("Có chỗ đậu xe không?")).toMatchObject({ outcome: "escalate", reason: "no_match" });
  });

  it("chỉ trả lời được một nửa thì không trả lời", () => {
    expect(ask("Tiền đặt trước bao nhiêu? Có chỗ đậu xe không?")).toMatchObject({
      outcome: "escalate",
      reason: "partial_match",
    });
  });
});

describe("answerCaseQuestion — điều khoản nháp", () => {
  it("điều khoản tiền đặt trước còn nháp ⇒ không tìm được, dù điều khoản khác đã xác nhận", () => {
    const clauses = CASE.map((c) => (c.topics.includes("deposit") ? { ...c, citable: false } : c));
    expect(ask("Tiền đặt trước là bao nhiêu?", clauses)).toMatchObject({ outcome: "escalate", reason: "no_match" });
  });

  it("nháp điểm cao hơn vẫn không bao giờ được trích", () => {
    const draft = deposit({
      clause_id: "c-draft",
      body: "Tiền đặt trước tiền đặt trước khoản đặt trước: 999,000,000₫ bao nhiêu.",
      citable: false,
      sort_order: 1,
    });
    const confirmed = deposit();
    const p = ask("Tiền đặt trước là bao nhiêu?", [draft, confirmed]);
    expect(p.outcome).toBe("answer");
    expect(p.citations.map((c) => c.clause_id)).toEqual(["c-deposit"]);
  });
});

describe("answerCaseQuestion — lô, mâu thuẫn", () => {
  const fourLots = buildFilledCase({
    lots: [1, 2, 3, 4].map((n) => ({
      lot_no: n,
      title: `Tài sản ${n}`,
      starting_price: n * 1_000_000_000,
      deposit_amount: n * 100_000_000,
      bid_step: n * 10_000_000,
    })),
  });

  it("4 lô, không nói lô nào ⇒ hỏi lại", () => {
    expect(ask("Tiền đặt trước là bao nhiêu?", fourLots)).toMatchObject({ outcome: "escalate", reason: "ambiguous" });
  });

  it("nói rõ lô ⇒ đúng một trích dẫn của lô đó", () => {
    const p = ask("Tiền đặt trước lô 2 là bao nhiêu?", fourLots);
    expect(p.outcome).toBe("answer");
    expect(p.citations).toHaveLength(1);
    expect(p.citations[0].quote).toContain("Lô 2");
    expect(p.citations[0].quote).not.toContain("Lô 3");
  });

  it("2 lô, không nói lô ⇒ một trích dẫn gồm cả hai dòng", () => {
    const p = ask("Tiền đặt trước là bao nhiêu?");
    expect(p.citations).toHaveLength(1);
    expect(p.citations[0].quote).toContain("Lô 1");
    expect(p.citations[0].quote).toContain("Lô 2");
  });

  it("hai tài liệu nêu số tiền khác nhau ⇒ không tự chọn", () => {
    const clarification: EngineClause = {
      ...deposit(),
      clause_id: "c-clar",
      document_id: "doc-clar",
      doc_type: "clarification",
      doc_title: "Giải đáp bổ sung",
      body: "Lô 2: tiền đặt trước điều chỉnh thành 200,000,000₫.",
    };
    expect(ask("Tiền đặt trước là bao nhiêu?", [...CASE, clarification])).toMatchObject({
      outcome: "escalate",
      reason: "conflict",
    });
  });
});

describe("splitSentences", () => {
  it("giữ vị trí ký tự và không cắt TP.HCM / số tiền", () => {
    const body = "Địa điểm: 12 Lê Lợi, TP.HCM. Tiền: 50.000.000₫;\nLô 2: xong.";
    const spans = splitSentences(body);
    expect(spans.map((s) => s.text)).toEqual(["Địa điểm: 12 Lê Lợi, TP.HCM.", "Tiền: 50.000.000₫;", "Lô 2: xong."]);
    for (const s of spans) expect(body.slice(s.start, s.end)).toBe(s.text);
  });
});

describe("compose + FAQ", () => {
  it("văn bản trả lời dán Zalo được: trích nguyên văn + dòng Căn cứ", () => {
    const p = ask("Bước giá là bao nhiêu?");
    const text = composeAnswerText(SESSION.code, snapshotCitations(p.citations, CASE));
    expect(text.startsWith(`Theo tài liệu phiên ${SESSION.code}:`)).toBe(true);
    expect(text).toContain("Căn cứ: Điều");
    expect(text).toContain(`“${p.citations[0].quote}”`);
    expect(text).not.toMatch(/[*_#`]/);
  });

  it("độ phủ: tài liệu đủ ⇒ 20/20; thiếu tài liệu tiền đặt trước ⇒ thiếu đúng 5 câu", () => {
    expect(faqCoverage(buildCaseFaq(CASE, SESSION.code))).toEqual({ answered: 20, total: 20 });
    const noDeposit = buildFilledCase({ types: ["notice", "rules", "viewing_schedule"] });
    expect(faqCoverage(buildCaseFaq(noDeposit, SESSION.code))).toEqual({ answered: 15, total: 20 });
  });
});
