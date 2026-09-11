import { phraseStarts } from "./topics";

/**
 * Câu hỏi tài liệu phiên KHÔNG thể trả lời dù có chạm từ khoá — kiểm TRƯỚC khi
 * tìm điều khoản. "Có nên đặt cọc không?" có chữ "đặt cọc" nhưng là xin tư vấn.
 */

export type OutOfScopeKind = "advice" | "registrants" | "side_deal" | "legal_tax" | "other_case";

const GROUPS: { kind: OutOfScopeKind; phrases: string[] }[] = [
  {
    kind: "advice",
    phrases: [
      "co nen mua",
      "co nen tham gia",
      "co nen dau gia",
      "co nen dang ky",
      "co nen tra",
      "co nen dat",
      "nen mua khong",
      "nen tham gia khong",
      "co loi khong",
      "loi hay lo",
      "du doan",
      "gia trung du kien",
      "du kien trung",
      "gia tri thuc",
      "gia thi truong",
      "tu van",
      "co dang mua",
      "co dang tien",
      "dinh gia lai",
    ],
  },
  {
    kind: "registrants",
    phrases: [
      "bao nhieu nguoi dang ky",
      "bao nhieu nguoi tham gia",
      "may nguoi dang ky",
      "may nguoi tham gia",
      "ai da dang ky",
      "co ai dang ky",
      "danh sach nguoi dang ky",
    ],
  },
  {
    kind: "side_deal",
    phrases: ["giam gia", "thoa thuan rieng", "khong qua dau gia", "ban ngoai", "lot tay", "boi duong"],
  },
  {
    kind: "legal_tax",
    phrases: ["khoi kien", "thue thu nhap", "thue truoc ba", "le phi truoc ba", "tranh chap", "sang ten", "vay ngan hang", "vay von"],
  },
  { kind: "other_case", phrases: ["phien khac", "cuoc dau gia khac"] },
];

const COMPILED = GROUPS.map((g) => ({ kind: g.kind, phrases: g.phrases.map((p) => p.split(" ")) }));

/** Mã phiên nhắc trong câu hỏi: "PDG000123" hoặc "PDG 000123". */
function mentionedCodes(words: readonly string[]): string[] {
  const out: string[] = [];
  words.forEach((w, i) => {
    const glued = /^pdg(\d{6})$/.exec(w);
    if (glued) out.push(glued[1]);
    else if (w === "pdg" && /^\d{6}$/.test(words[i + 1] ?? "")) out.push(words[i + 1]);
  });
  return out;
}

export function detectOutOfScope(words: readonly string[], sessionCode?: string | null): OutOfScopeKind | null {
  for (const g of COMPILED) {
    if (g.phrases.some((p) => phraseStarts(words, p).length > 0)) return g.kind;
  }
  const own = sessionCode ? /(\d{6})$/.exec(sessionCode.trim())?.[1] : undefined;
  if (own && mentionedCodes(words).some((code) => code !== own)) return "other_case";
  return null;
}
