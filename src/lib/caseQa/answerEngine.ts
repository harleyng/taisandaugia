import { tokensVi } from "@/lib/normalizeVi";
import type {
  CaseQaProposal,
  CaseTopic,
  EngineClause,
  EngineEscalationReason,
  ProposedCitation,
} from "@/types/case-qa";
import { detectOutOfScope } from "./outOfScope";
import { countTopicHits, detectQuestionTopics, isContentWord, tokenizeQuestion } from "./topics";

/**
 * Engine MOCK trả lời câu hỏi CHỈ từ điều khoản đã xác nhận của một phiên.
 *
 * Luật bất biến (có test chứng minh):
 *  - Mọi kết quả "answer" có 1–3 trích dẫn; mỗi trích dẫn là CHUỖI CON NGUYÊN VĂN
 *    của một điều khoản `citable`.
 *  - Không trả lời được trọn vẹn thì chuyển người — không bao giờ trả lời nửa câu.
 *
 * Engine không phải ranh giới tin cậy: nó chạy trên trình duyệt. RPC
 * case_qa_apply_proposal kiểm lại từng trích dẫn và TỰ dựng câu trả lời.
 */

export const ENGINE_ID = "mock-v1";
export const ENGINE_FLOOR = 0.5;
export const MAX_CITATIONS = 3;
export const MAX_QUOTE = 500;
export const MIN_QUOTE = 8;
/** Điều khoản ngắn được trích cả thân khi không câu nào chứa từ khoá. */
const WHOLE_BODY_MAX = 400;

const LOT_TOPICS: ReadonlySet<CaseTopic> = new Set<CaseTopic>(["deposit", "starting_price", "bid_step"]);

export interface AnswerInput {
  question: string;
  sessionCode?: string | null;
  clauses: readonly EngineClause[];
}

export interface SentenceSpan {
  start: number;
  end: number;
  text: string;
}

/**
 * Tách câu trên văn bản GỐC, giữ vị trí ký tự để đoạn trích luôn là chuỗi con.
 * Ranh giới: xuống dòng, dấu chấm phẩy, hoặc . ! ? theo sau là khoảng trắng — nên
 * "TP.HCM" và "50.000.000" không bị cắt.
 */
export function splitSentences(body: string): SentenceSpan[] {
  const out: SentenceSpan[] = [];
  const push = (a: number, b: number) => {
    while (a < b && /[\s\-•*]/.test(body[a])) a++;
    while (b > a && /\s/.test(body[b - 1])) b--;
    if (b > a) out.push({ start: a, end: b, text: body.slice(a, b) });
  };
  let s = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\n") {
      push(s, i);
      s = i + 1;
    } else if (ch === ";") {
      push(s, i + 1);
      s = i + 1;
    } else if ((ch === "." || ch === "!" || ch === "?") && (i + 1 === body.length || /\s/.test(body[i + 1]))) {
      push(s, i + 1);
      s = i + 1;
    }
  }
  push(s, body.length);
  return out;
}

function trimSpan(body: string, start: number, end: number) {
  while (start < end && /\s/.test(body[start])) start++;
  while (end > start && /\s/.test(body[end - 1])) end--;
  return { start, end };
}

/** "Lô 2: …" / "Lô số 2 – …" → 2. So khớp trên token nên không phụ thuộc NFC/NFD. */
function lotNoOf(text: string): number | null {
  const t = tokensVi(text);
  if (t[0] !== "lo") return null;
  const n = t[1] === "so" ? t[2] : t[1];
  return n && /^\d+$/.test(n) ? Number(n) : null;
}

function askedLot(words: readonly string[]): number | null {
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== "lo") continue;
    const n = words[i + 1] === "so" ? words[i + 2] : words[i + 1];
    if (n && /^\d+$/.test(n)) return Number(n);
  }
  return null;
}

interface Candidate {
  clause: EngineClause;
  start: number;
  end: number;
  hits: number;
  overlap: number;
  score: number;
}

function overlapCount(tokens: readonly string[], content: ReadonlySet<string>): number {
  return new Set(tokens.filter((t) => content.has(t))).size;
}

function clauseCandidate(topic: CaseTopic, clause: EngineClause, content: ReadonlySet<string>): Candidate | null {
  let best: Candidate | null = null;
  for (const s of splitSentences(clause.body)) {
    const toks = tokensVi(s.text);
    const hits = countTopicHits(topic, toks);
    if (hits < 1) continue;
    const overlap = overlapCount(toks, content);
    const score = 3 * hits + overlap;
    if (!best || score > best.score) best = { clause, start: s.start, end: s.end, hits, overlap, score };
  }
  if (best) return best;

  // Chuyên viên đã gắn chủ đề cho điều khoản nhưng thân không chứa từ khoá: chỉ
  // trích cả thân khi đủ ngắn, và độ tin cậy thấp (hits = số lần tiêu đề khớp).
  if (clause.body.trim().length > WHOLE_BODY_MAX) return null;
  const span = trimSpan(clause.body, 0, clause.body.length);
  const hits = clause.heading ? countTopicHits(topic, tokensVi(clause.heading)) : 0;
  const overlap = overlapCount(tokensVi(clause.body), content);
  return { clause, ...span, hits, overlap, score: 3 * hits + overlap };
}

const byScore = (a: Candidate, b: Candidate) =>
  b.score - a.score ||
  a.clause.sort_order - b.clause.sort_order ||
  a.clause.clause_id.localeCompare(b.clause.clause_id) ||
  a.start - b.start;

const MONEY_RE = /\d{1,3}(?:[.,]\d{3})+|\d{5,}/g;
const DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;

function factsOf(text: string) {
  const money = new Set((text.match(MONEY_RE) ?? []).map((m) => m.replace(/[.,]/g, "")));
  const dates = new Set([...text.matchAll(DATE_RE)].map((m) => `${Number(m[1])}/${Number(m[2])}/${m[3]}`));
  return { money, dates };
}

const disjoint = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size > 0 && b.size > 0 && ![...a].some((x) => b.has(x));

/** Hai tài liệu nêu số tiền / ngày KHÔNG giao nhau cho cùng một chủ đề ⇒ không tự chọn bên nào. */
function hasConflict(perDoc: readonly Candidate[], wholeBody: boolean): boolean {
  const facts = perDoc.map((c) => factsOf(wholeBody ? c.clause.body : c.clause.body.slice(c.start, c.end)));
  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      if (disjoint(facts[i].money, facts[j].money) || disjoint(facts[i].dates, facts[j].dates)) return true;
    }
  }
  return false;
}

const escalate = (reason: EngineEscalationReason, topics: CaseTopic[] = []): CaseQaProposal => ({
  outcome: "escalate",
  reason,
  topics,
  confidence: 0,
  citations: [],
  engine: ENGINE_ID,
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function topicConfidence(c: Candidate): number {
  const base = c.hits > 0 ? 0.55 + 0.1 * Math.min(c.hits, 3) : 0.45;
  return clamp(base + 0.04 * Math.min(c.overlap, 5), 0, 0.97);
}

export function answerCaseQuestion({ question, sessionCode, clauses }: AnswerInput): CaseQaProposal {
  const q = tokenizeQuestion(question);
  if (q.words.join("").length < 5) return escalate("no_match");

  // Lọc phòng thủ: RPC đã chỉ trả điều khoản citable, nhưng engine không được
  // phép tin điều đó.
  const citable = clauses.filter((c) => c.citable);
  if (!citable.length) return escalate("no_documents");

  if (detectOutOfScope(q.words, sessionCode)) return escalate("out_of_scope");

  const detected = detectQuestionTopics(q);
  if (!detected.topics.length) return escalate("no_match");

  const segIds = [...new Set(q.seg.filter((s) => s >= 0))];
  const unmatched = segIds.some(
    (s) => !detected.coveredSegs.has(s) && q.words.some((w, i) => q.seg[i] === s && isContentWord(w)),
  );
  if (unmatched) return escalate("partial_match", detected.topics);

  const content = new Set(q.words.filter(isContentWord));
  const spans = new Map<string, { clause: EngineClause; start: number; end: number }>();
  const order: string[] = [];
  let confidence = 1;

  for (const topic of detected.topics) {
    const cands = citable
      .filter((c) => c.topics.includes(topic))
      .map((c) => clauseCandidate(topic, c, content))
      .filter((c): c is Candidate => c !== null)
      .sort(byScore);
    if (!cands.length) return escalate("no_match", detected.topics);

    const perDoc = new Map<string, Candidate>();
    for (const c of cands) if (!perDoc.has(c.clause.document_id)) perDoc.set(c.clause.document_id, c);
    if (perDoc.size >= 2 && hasConflict([...perDoc.values()], LOT_TOPICS.has(topic))) {
      return escalate("conflict", detected.topics);
    }

    const pick = cands[0];
    let { start, end } = pick;

    if (LOT_TOPICS.has(topic)) {
      const lots = splitSentences(pick.clause.body)
        .map((s) => ({ ...s, lot: lotNoOf(s.text) }))
        .filter((s) => s.lot !== null);
      if (lots.length >= 2) {
        const want = askedLot(q.words);
        if (want !== null) {
          const hit = lots.find((l) => l.lot === want);
          if (!hit) return escalate("ambiguous", detected.topics);
          ({ start, end } = hit);
        } else if (lots.length <= MAX_CITATIONS) {
          start = Math.min(pick.start, lots[0].start);
          end = lots[lots.length - 1].end;
          if (end - start > MAX_QUOTE) return escalate("ambiguous", detected.topics);
        } else {
          return escalate("ambiguous", detected.topics);
        }
      }
    }

    confidence = Math.min(confidence, topicConfidence(pick));

    const prev = spans.get(pick.clause.clause_id);
    if (prev) {
      prev.start = Math.min(prev.start, start);
      prev.end = Math.max(prev.end, end);
    } else {
      spans.set(pick.clause.clause_id, { clause: pick.clause, start, end });
      order.push(pick.clause.clause_id);
    }
  }

  if (order.length > MAX_CITATIONS) return escalate("partial_match", detected.topics);

  const citations: ProposedCitation[] = [];
  for (const id of order) {
    const { clause, start, end } = spans.get(id)!;
    let quote = clause.body.slice(start, end);
    if (quote.length < MIN_QUOTE) {
      const whole = clause.body.trim();
      if (whole.length < MIN_QUOTE || whole.length > MAX_QUOTE) return escalate("low_confidence", detected.topics);
      quote = whole;
    }
    if (quote.length > MAX_QUOTE) return escalate("partial_match", detected.topics);
    citations.push({ clause_id: id, quote });
  }

  if (confidence < ENGINE_FLOOR) return escalate("low_confidence", detected.topics);

  return {
    outcome: "answer",
    topics: detected.topics,
    confidence: Math.round(confidence * 1000) / 1000,
    citations,
    engine: ENGINE_ID,
  };
}
