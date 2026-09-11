// Câu giải thích ĐỘ PHÙ HỢP của một tổ chức — một câu tiếng Việt thường, đọc là hiểu.
//
// Điểm khớp (OrgScoreDetail) trả lời "bao nhiêu điểm"; file này trả lời "vì sao".
// Chủ tài sản đang chọn nơi ký gửi tài sản của mình: "82/100" không giúp họ quyết,
// "chuyên nhóm bất động sản, cùng địa bàn, nhưng chưa có sàn trực tuyến" thì có.
//
// Tách khỏi orgMatching.ts CÓ Ý: file đó là engine chấm điểm thuần: thêm văn xuôi
// vào là trộn hai tầng. Ở đây chỉ ĐỌC breakdown mà engine đã export.
//
// LUẬT BẤT BIẾN: không bao giờ khẳng định điều không có dữ liệu. Tiêu chí thiếu
// (chưa chọn tỉnh, nhờ định giá, không khai mức thù lao) ⇒ IM LẶNG về tín hiệu đó,
// chứ không nói "phù hợp" dựa trên điểm mặc định mà engine gán khi thiếu dữ liệu.

import { PARENT_NAME } from "@/constants/category.constants";
import {
  EXPERIENCE_TIER_LABELS,
  MATCH_WEIGHTS,
  type MatchBreakdown,
  type MatchCriteria,
  type OrgMatchResult,
} from "./orgMatching";

/** Đạt ≥ ngưỡng này so với trọng số tối đa thì tính là điểm mạnh. */
const STRONG = 0.75;
/** Đạt ≤ ngưỡng này thì tính là điểm trừ đáng nói. */
const WEAK = 0.34;

type Signal = keyof MatchBreakdown;

const ratio = (b: MatchBreakdown, k: Signal): number => b[k] / MATCH_WEIGHTS[k];

/**
 * Tín hiệu nào ĐƯỢC PHÉP nhắc tới với bộ tiêu chí này.
 *
 * Engine gán điểm mặc định khi thiếu dữ liệu (địa bàn 50%, thù lao 70%, kinh
 * nghiệm quy về tầng giữa khi nhờ định giá). Những điểm đó hợp lý để XẾP HẠNG
 * nhưng không phải căn cứ để NÓI với người dùng — nhắc là bịa.
 */
function speakable(c: MatchCriteria): Set<Signal> {
  const s = new Set<Signal>(["specialty", "format"]);
  if (c.province) s.add("locality");
  if (c.startingPrice) s.add("experience");
  if (c.acceptableCommissionPct != null) s.add("commission");
  return s;
}

/** Mệnh đề khẳng định cho từng tín hiệu mạnh. */
function strengthClause(k: Signal, r: OrgMatchResult, c: MatchCriteria): string | null {
  const { org, attrs } = r;
  switch (k) {
    case "specialty":
      return `chuyên nhóm ${(PARENT_NAME[c.parentSlug] ?? "tài sản này").toLowerCase()}`;
    case "locality":
      return org.province ? `cùng địa bàn ${org.province}` : null;
    case "format":
      // "Trực tiếp" thì tổ chức nào cũng đáp ứng — nói ra là khen suông.
      return c.format === "truc_tiep" ? null : "có sàn đấu giá trực tuyến";
    case "experience":
      return `${EXPERIENCE_TIER_LABELS[attrs.experience_tier].toLowerCase()} ở tầm giá tài sản của bạn`;
    case "commission":
      return `thù lao chào ~${attrs.commission_rate}% nằm trong mức bạn chấp nhận`;
    default:
      return null;
  }
}

/** Mệnh đề lưu ý cho tín hiệu yếu — nói thẳng, không vòng vo. */
function caveatClause(k: Signal, r: OrgMatchResult, c: MatchCriteria): string | null {
  const { attrs } = r;
  switch (k) {
    case "specialty":
      return `chưa ghi nhận kinh nghiệm ở nhóm ${(PARENT_NAME[c.parentSlug] ?? "tài sản này").toLowerCase()}`;
    case "locality":
      return "không cùng tỉnh/thành với tài sản";
    case "format":
      return "chưa có sàn đấu giá trực tuyến";
    case "experience":
      return "chưa nhiều hồ sơ ở tầm giá này";
    case "commission":
      return `thù lao chào ~${attrs.commission_rate}% cao hơn mức bạn nêu`;
    default:
      return null;
  }
}

/** Nối danh sách mệnh đề theo kiểu tiếng Việt: "a, b và c". */
function join(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} và ${parts[parts.length - 1]}`;
}

/**
 * Một câu giải thích vì sao tổ chức này phù hợp (hoặc không hẳn phù hợp).
 *
 * Luôn trả về một câu — kể cả tổ chức điểm thấp: danh sách cho chọn BẤT KỲ tổ
 * chức nào, nên thẻ nào cũng phải nói được sự thật về mình. Không có gì đáng
 * khen thì nêu con số uy tín trung lập rồi tới phần lưu ý.
 */
export function orgFitSentence(result: OrgMatchResult, c: MatchCriteria): string {
  const { breakdown, attrs } = result;
  const allowed = speakable(c);
  const signals = (Object.keys(MATCH_WEIGHTS) as Signal[]).filter((k) => allowed.has(k));

  // Mạnh nhất trước, tối đa 2 mệnh đề — câu thứ ba biến thành đoạn văn.
  const strengths = signals
    .filter((k) => ratio(breakdown, k) >= STRONG)
    .sort((a, b) => ratio(breakdown, b) - ratio(breakdown, a))
    .map((k) => strengthClause(k, result, c))
    .filter((x): x is string => !!x)
    .slice(0, 2);

  // Lưu ý: yếu nhất trước. Có điểm mạnh thì chỉ nêu MỘT (liệt kê hết thì thẻ nào
  // cũng như bản cáo trạng); KHÔNG có điểm mạnh nào thì nêu hai — câu mở đầu bằng
  // số phiên thành công mà chỉ kể một nửa số điểm yếu là câu khen hộ.
  const caveats = signals
    .filter((k) => ratio(breakdown, k) <= WEAK)
    .sort((a, b) => ratio(breakdown, a) - ratio(breakdown, b))
    .map((k) => caveatClause(k, result, c))
    .filter((x): x is string => !!x)
    .slice(0, strengths.length ? 1 : 2);

  const sessions = `${attrs.successful_sessions} phiên đấu giá thành công`;
  const head = strengths.length ? `${join(strengths)}, ${sessions}` : sessions;
  const sentence = caveats.length ? `${head} — nhưng ${join(caveats)}.` : `${head}.`;

  // Hoa đầu câu: mệnh đề nào cũng viết thường để nối được ở giữa câu.
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
