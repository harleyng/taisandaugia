import { tokensVi } from "@/lib/normalizeVi";
import type { CaseTopic } from "@/types/case-qa";

/**
 * Bộ từ vựng chủ đề của engine hỏi đáp (bản mock, không phải mô hình ngôn ngữ).
 *
 * Mẫu viết ở dạng ĐÃ chuẩn hoá (không dấu, thường). Chuỗi = cụm liền nhau; mảng =
 * mọi cụm cùng có mặt trong MỘT đoạn câu (đoạn tách bởi ? ; ! xuống dòng và "và").
 *
 * `suppresses`: chủ đề hẹp thắng chủ đề rộng trong cùng đoạn — "hạn nộp tiền đặt
 * trước" là hỏi THỜI HẠN, không phải hỏi số tiền.
 *
 * Danh sách này là nguồn duy nhất của mã chủ đề: cột case_document_clauses.topics
 * cố ý không có CHECK liệt kê giá trị để khỏi nhân bản SQL↔TS.
 */

export type TopicPattern = string | readonly string[];

export interface CaseTopicDef {
  id: CaseTopic;
  label: string;
  patterns: readonly TopicPattern[];
  suppresses?: readonly CaseTopic[];
}

export const CASE_TOPICS: readonly CaseTopicDef[] = [
  {
    id: "deposit",
    label: "Tiền đặt trước",
    patterns: ["tien dat truoc", "dat coc", "tien coc", "khoan dat truoc", "dat truoc bao nhieu", "coc bao nhieu"],
  },
  {
    id: "deposit_deadline",
    label: "Hạn nộp tiền đặt trước",
    patterns: [
      "han nop tien dat truoc",
      "han dat coc",
      "han nop coc",
      ["tien dat truoc", "han"],
      ["tien dat truoc", "khi nao"],
      ["tien dat truoc", "bao gio"],
      ["tien dat truoc", "cham nhat"],
      ["tien dat truoc", "truoc ngay"],
      ["coc", "khi nao"],
      ["coc", "bao gio"],
      ["coc", "cham nhat"],
    ],
    suppresses: ["deposit", "registration_deadline"],
  },
  {
    id: "deposit_method",
    label: "Cách nộp tiền đặt trước",
    patterns: [
      "so tai khoan",
      "chuyen khoan",
      "vao tai khoan",
      "tai khoan ngan hang",
      "nop tien mat",
      "noi dung chuyen",
      ["tien dat truoc", "nop o dau"],
      ["tien dat truoc", "nop the nao"],
      ["tien dat truoc", "tai khoan"],
      ["tien dat truoc", "hinh thuc"],
      ["coc", "tai khoan"],
      ["coc", "chuyen"],
    ],
    suppresses: ["deposit", "format"],
  },
  {
    id: "deposit_refund",
    label: "Hoàn trả tiền đặt trước",
    patterns: [
      "hoan tra",
      "hoan lai",
      "hoan coc",
      "tra lai tien",
      "lay lai tien",
      "nhan lai tien",
      ["tien dat truoc", "tra lai"],
      ["coc", "tra lai"],
    ],
    suppresses: ["deposit", "deposit_deadline"],
  },
  {
    id: "deposit_forfeit",
    label: "Không được nhận lại tiền đặt trước",
    patterns: [
      "khong duoc hoan",
      "khong duoc tra lai",
      "khong duoc nhan lai",
      "mat coc",
      "mat tien dat truoc",
      "bi giu lai",
      "bi tich thu",
    ],
    suppresses: ["deposit", "deposit_refund", "deposit_deadline"],
  },
  {
    id: "registration_deadline",
    label: "Hạn đăng ký tham gia",
    patterns: [
      "han dang ky",
      "han chot",
      "han nop ho so",
      "het han dang ky",
      "dang ky den ngay",
      "dang ky truoc ngay",
      ["dang ky", "khi nao"],
      ["dang ky", "bao gio"],
      ["dang ky", "han"],
      ["dang ky", "cham nhat"],
      ["nop ho so", "khi nao"],
      ["nop ho so", "han"],
      ["nop ho so", "bao gio"],
      ["nop ho so", "cham nhat"],
    ],
  },
  {
    id: "document_sale",
    label: "Bán hồ sơ tham gia",
    patterns: [
      "ban ho so",
      "noi ban ho so",
      "thoi gian ban ho so",
      ["mua ho so", "o dau"],
      ["mua ho so", "khi nao"],
      ["mua ho so", "bao gio"],
      ["nhan ho so", "o dau"],
      ["lay ho so", "o dau"],
    ],
    suppresses: ["venue", "schedule"],
  },
  {
    id: "document_fee",
    label: "Tiền mua hồ sơ",
    patterns: [
      "tien mua ho so",
      "phi ho so",
      "gia ho so",
      "tien ho so",
      "le phi ho so",
      "phi tham gia",
      ["mua ho so", "bao nhieu"],
      ["ho so", "bao nhieu tien"],
    ],
    suppresses: ["document_sale"],
  },
  {
    id: "documents_required",
    label: "Giấy tờ cần chuẩn bị",
    patterns: [
      "giay to",
      "can chuan bi",
      "can mang theo",
      "thanh phan ho so",
      "ho so gom",
      "ho so dang ky gom",
      "cccd",
      "can cuoc",
      "chung minh nhan dan",
      "ho chieu",
      "giay phep kinh doanh",
      ["ho so", "gom nhung"],
      ["ho so", "can nhung"],
    ],
  },
  {
    id: "eligibility",
    label: "Đối tượng được tham gia",
    patterns: [
      "ai duoc tham gia",
      "ai duoc dang ky",
      "doi tuong",
      "dieu kien tham gia",
      "khong duoc tham gia",
      "co duoc tham gia",
      "duoc tham gia khong",
      "nguoi nuoc ngoai",
      "viet kieu",
    ],
  },
  {
    id: "proxy",
    label: "Uỷ quyền tham gia",
    patterns: ["uy quyen", "nguoi khac di thay", "di thay", "tham gia thay", "dau gia thay", "nho nguoi"],
  },
  {
    id: "viewing",
    label: "Xem tài sản",
    patterns: [
      "xem tai san",
      "xem nha",
      "xem dat",
      "xem xe",
      "xem thuc te",
      "xem hien trang",
      "di xem",
      "lich xem",
      "tham quan tai san",
      "kiem tra tai san",
      "xem va kiem tra",
    ],
    suppresses: ["venue", "schedule"],
  },
  {
    id: "starting_price",
    label: "Giá khởi điểm",
    patterns: ["gia khoi diem", "gia khoi dau", "gia ban dau"],
  },
  {
    id: "bid_step",
    label: "Bước giá",
    patterns: ["buoc gia", "moi lan tra", "moi lan tang", "buoc tang", "tra them toi thieu"],
  },
  {
    id: "schedule",
    label: "Thời gian tổ chức",
    patterns: [
      "thoi gian to chuc",
      "thoi gian dau gia",
      "ngay to chuc",
      "gio to chuc",
      "lich dau gia",
      "may gio",
      "ngay gio nao",
      "dien ra khi nao",
      "dien ra vao",
      "khi nao dau gia",
      "dau gia khi nao",
      "bao gio dau gia",
      "dau gia vao ngay",
      "dau gia luc",
    ],
  },
  {
    id: "venue",
    label: "Địa điểm tổ chức",
    patterns: ["dia diem", "to chuc o dau", "to chuc tai", "dau gia o dau", "dia chi to chuc", "phong dau gia", "o dau to chuc"],
  },
  {
    id: "format",
    label: "Hình thức đấu giá",
    patterns: ["hinh thuc", "phuong thuc", "truc tuyen", "online", "bo phieu", "tra gia len", "dat gia xuong", "dau gia kin"],
  },
  {
    id: "payment",
    label: "Thanh toán tiền trúng đấu giá",
    patterns: ["thanh toan", "han thanh toan", "tien trung dau gia", "so tien con lai", "nop tien trung"],
  },
  {
    id: "auction_failed",
    label: "Đấu giá không thành",
    patterns: ["khong thanh", "chi mot nguoi", "chi co mot nguoi", "mot nguoi dang ky", "khong ai tra gia"],
  },
  {
    id: "withdrawal",
    label: "Rút lại giá, từ chối kết quả",
    patterns: ["rut lai gia", "tu choi ket qua", "tu choi ky hop dong", "tu choi mua", "khong ky hop dong"],
  },
];

export const CASE_TOPIC_IDS: readonly CaseTopic[] = CASE_TOPICS.map((t) => t.id);

export const CASE_TOPIC_LABELS = Object.fromEntries(CASE_TOPICS.map((t) => [t.id, t.label])) as Record<
  CaseTopic,
  string
>;

export const isCaseTopic = (v: string): v is CaseTopic => (CASE_TOPIC_IDS as readonly string[]).includes(v);

/**
 * Từ không mang nội dung — dùng để (1) bỏ qua đoạn câu chỉ là chào hỏi, (2) tính
 * độ trùng từ giữa câu hỏi và điều khoản. KHÔNG có "tai" (tài sản) và "can" (căn hộ).
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "ad", "admin", "ah", "anh", "ban", "bao", "biet", "cac", "cai", "cam", "chao", "chi", "cho", "co",
  "con", "cua", "da", "day", "de", "di", "do", "dum", "duoc", "em", "gi", "giup", "ha", "hay", "hoac",
  "hoi", "k", "khi", "khong", "ko", "la", "lam", "lo", "luc", "ma", "minh", "mot", "muon", "nao", "nay",
  "nha", "nhe", "nhi", "nhieu", "nhung", "o", "oi", "ok", "oke", "on", "phai", "phien", "roi", "sao",
  "se", "shop", "thank", "thanks", "the", "thi", "toi", "tu", "u", "uh", "va", "vang", "vay", "ve", "vi",
  "voi", "vui", "long", "xin", "ya",
]);

export function isContentWord(w: string): boolean {
  return w.length > 0 && !STOPWORDS.has(w) && !/^pdg\d*$/.test(w) && !/^\d{1,2}$/.test(w) && !/^\d{6}$/.test(w);
}

// ─── Khớp mẫu ────────────────────────────────────────────────────────────────

interface CompiledTopic {
  def: CaseTopicDef;
  seq: string[][];
  all: string[][][];
}

const COMPILED: CompiledTopic[] = CASE_TOPICS.map((def) => ({
  def,
  seq: def.patterns.filter((p): p is string => typeof p === "string").map((p) => p.split(" ")),
  all: def.patterns
    .filter((p): p is readonly string[] => typeof p !== "string")
    .map((parts) => parts.map((p) => p.split(" "))),
}));

const BY_ID = new Map(COMPILED.map((c) => [c.def.id, c]));

/** Vị trí bắt đầu của mọi lần xuất hiện cụm `phrase` trong tokens[from, to). */
export function phraseStarts(
  tokens: readonly string[],
  phrase: readonly string[],
  from = 0,
  to = tokens.length,
): number[] {
  const out: number[] = [];
  for (let i = from; i + phrase.length <= to; i++) {
    let ok = true;
    for (let j = 0; j < phrase.length; j++) {
      if (tokens[i + j] !== phrase[j]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

/** Số MẪU của một chủ đề xuất hiện trong một đoạn văn (câu điều khoản / tiêu đề). */
export function countTopicHits(topic: CaseTopic, tokens: readonly string[]): number {
  const c = BY_ID.get(topic);
  if (!c) return 0;
  let hits = 0;
  for (const p of c.seq) if (phraseStarts(tokens, p).length) hits++;
  for (const parts of c.all) if (parts.every((p) => phraseStarts(tokens, p).length > 0)) hits++;
  return hits;
}

export interface QuestionTokens {
  words: string[];
  /** Mã đoạn của từng từ; -1 = từ nối "và" (ranh giới đoạn). */
  seg: number[];
}

export function tokenizeQuestion(question: string): QuestionTokens {
  const words: string[] = [];
  const seg: number[] = [];
  let s = 0;
  for (const chunk of question.split(/[?;!\n]+/)) {
    const toks = tokensVi(chunk);
    if (!toks.length) continue;
    for (const t of toks) {
      if (t === "va") {
        words.push(t);
        seg.push(-1);
        s++;
        continue;
      }
      words.push(t);
      seg.push(s);
    }
    s++;
  }
  return { words, seg };
}

export interface TopicMatch {
  topic: CaseTopic;
  start: number;
  end: number;
  segs: number[];
  kind: "seq" | "all";
}

export interface QuestionTopics {
  topics: CaseTopic[];
  matches: TopicMatch[];
  coveredSegs: ReadonlySet<number>;
}

export function detectQuestionTopics({ words, seg }: QuestionTokens): QuestionTopics {
  const raw: TopicMatch[] = [];
  const segIds = [...new Set(seg.filter((x) => x >= 0))];

  for (const c of COMPILED) {
    for (const p of c.seq) {
      for (const i of phraseStarts(words, p)) {
        const segs = [...new Set(seg.slice(i, i + p.length).filter((x) => x >= 0))];
        raw.push({ topic: c.def.id, start: i, end: i + p.length, segs, kind: "seq" });
      }
    }
    // Mẫu tổ hợp phải nằm gọn trong MỘT đoạn — "hạn đăng ký và tiền đặt trước"
    // là hai câu hỏi, không phải "hạn nộp tiền đặt trước".
    for (const parts of c.all) {
      for (const s of segIds) {
        const from = seg.indexOf(s);
        const to = seg.lastIndexOf(s) + 1;
        let start = Number.POSITIVE_INFINITY;
        let end = -1;
        let ok = true;
        for (const p of parts) {
          const at = phraseStarts(words, p, from, to);
          if (!at.length) {
            ok = false;
            break;
          }
          start = Math.min(start, at[0]);
          end = Math.max(end, at[0] + p.length);
        }
        if (ok) raw.push({ topic: c.def.id, start, end, segs: [s], kind: "all" });
      }
    }
  }

  // Cụm liền dài hơn của chủ đề khác nuốt cụm ngắn nằm trong nó.
  const contained = raw.filter(
    (m) =>
      m.kind !== "seq" ||
      !raw.some(
        (n) =>
          n.kind === "seq" &&
          n.topic !== m.topic &&
          n.start <= m.start &&
          n.end >= m.end &&
          n.end - n.start > m.end - m.start,
      ),
  );

  const matches = contained
    .filter(
      (m) =>
        !contained.some(
          (n) =>
            n.topic !== m.topic &&
            (BY_ID.get(n.topic)?.def.suppresses ?? []).includes(m.topic) &&
            n.segs.some((s) => m.segs.includes(s)),
        ),
    )
    .sort((a, b) => a.start - b.start);

  const topics: CaseTopic[] = [];
  for (const m of matches) if (!topics.includes(m.topic)) topics.push(m.topic);
  return { topics, matches, coveredSegs: new Set(matches.flatMap((m) => m.segs)) };
}
