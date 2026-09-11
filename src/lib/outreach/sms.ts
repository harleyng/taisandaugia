// SMS tiếp thị: KHÔNG dấu (GSM-7, 160 ký tự/tin) — tin có dấu tốn gấp đôi và
// nhiều brandname chặn Unicode.

export const SMS_MAX = 160;

export const stripDiacritics = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

/** Chỉ ký tự in được ASCII — tập an toàn con của GSM-7. */
export const isSmsSafe = (s: string): boolean => /^[\x20-\x7E]*$/.test(s);

const clean = (s: string) => stripDiacritics(s).replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();

export interface SmsParts {
  /** Luôn giữ: "[Bao Tin] PDG000012:" */
  lead: string;
  /** Rút gọn đầu tiên khi quá dài. */
  subject: string;
  /** Giữ nếu còn chỗ, bỏ trước link. */
  details: string[];
  /** Luôn giữ. */
  link: string;
}

/**
 * Ghép SMS ≤ max ký tự. Thứ tự hy sinh: bỏ bớt details từ cuối → cắt subject →
 * bỏ subject. lead + link không bao giờ bị cắt.
 */
export function composeSms({ lead, subject, details, link }: SmsParts, max = SMS_MAX): string {
  const L = clean(lead);
  const K = clean(link);
  let S = clean(subject);
  const D = details.map(clean).filter(Boolean);
  const join = (subj: string, det: string[]) => [L, subj, ...det, K].filter(Boolean).join(" ");

  while (D.length && join(S, D).length > max) D.pop();
  if (join(S, D).length > max) {
    const room = max - join("", D).length - 1;
    S = room > 6 ? `${S.slice(0, room - 2).trimEnd()}..` : "";
  }
  return join(S, D).slice(0, max);
}
