// Luật hiển thị thuần của trang Hồ sơ online (tách khỏi component để fast refresh + test).

import type { SharedPosting, SharedPostingSession } from "./types";

/** "Số 12, Phường 1, Quận 7, TP. Hồ Chí Minh" — địa chỉ / phường chỉ có khi link cho phép. */
export const sharedLocation = (p: Pick<SharedPosting, "location">) =>
  [p.location.address, p.location.ward, p.location.district, p.location.province].filter(Boolean).join(", ");

export type SessionCta = "dossier" | "follow" | "ended";

/** Việc chính của người nhận link: mua hồ sơ (phiên còn hạn đăng ký), nhận thông báo, hay phiên đã qua. */
export function sessionCta(session: SharedPostingSession | null, now: Date = new Date()): SessionCta {
  if (!session) return "follow";
  const end = session.registrationEndAt ?? session.endsAt;
  if (end && Date.parse(end) <= now.getTime()) return "ended";
  return "dossier";
}

/** Chữ cái đầu của tên đơn vị — đơn vị chưa có logo. */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)).toUpperCase();
}

// ─── Thẻ giá & lịch phiên (design "Ho So Online Tai San v2") ─────────────────

export type TimelineState = "done" | "now" | "todo";
export interface TimelineStep {
  label: string;
  at: string;
  state: TimelineState;
}

/** Mở đăng ký → Hạn đăng ký → Thời gian đấu giá; mốc đã qua là "done", mốc kế tiếp là "now". */
export function sessionTimeline(session: SharedPostingSession, now: Date = new Date()): TimelineStep[] {
  const steps = [
    { label: "Mở đăng ký", at: session.registrationStartAt },
    { label: "Hạn đăng ký", at: session.registrationEndAt },
    { label: "Thời gian đấu giá", at: session.startsAt },
  ].filter((s): s is { label: string; at: string } => !!s.at);
  let current = false;
  return steps.map((s) => {
    if (Date.parse(s.at) <= now.getTime()) return { ...s, state: "done" as const };
    const state: TimelineState = current ? "todo" : "now";
    current = true;
    return { ...s, state };
  });
}

/** "9 ngày" / "5 giờ" / "dưới 1 giờ" còn lại tới hạn đăng ký; null khi không có hạn hoặc đã qua. */
export function registrationLeft(session: SharedPostingSession, now: Date = new Date()): string | null {
  const end = session.registrationEndAt ? Date.parse(session.registrationEndAt) : NaN;
  if (Number.isNaN(end)) return null;
  const ms = end - now.getTime();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)} ngày`;
  return hours >= 1 ? `${hours} giờ` : "dưới 1 giờ";
}

/** "Phiên PDG000012 · Lô 1" — dòng phụ dưới tên tổ chức đấu giá. */
export function sessionSubline(session: SharedPostingSession): string {
  return [session.code ? `Phiên ${session.code}` : session.title, session.lotNo ? `Lô ${session.lotNo}` : null]
    .filter(Boolean)
    .join(" · ");
}

/** Giá lớn ở thẻ giá: 8,650,000,000 → { value: "8.65", unit: "tỷ" } — 2 chữ số thập phân (thẻ khác làm tròn 1). */
export function heroPriceParts(amount: number): { value: string; unit: string } {
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (amount >= 1_000_000_000) return { value: fmt(amount / 1_000_000_000), unit: "tỷ" };
  if (amount >= 1_000_000) return { value: fmt(amount / 1_000_000), unit: "triệu" };
  return { value: Math.round(amount).toLocaleString("en-US"), unit: "₫" };
}

/** "0912345678" → "0912 345 678"; số khác độ dài giữ nguyên. */
export function formatSharePhone(phone: string): string {
  const d = phone.replace(/\s+/g, "");
  return /^\d{10}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : phone;
}

/** Diện tích dùng để quy giá ra /m² — ưu tiên diện tích đất. */
export function priceAreaBasis(specs: Record<string, unknown>): { m2: number; land: boolean } | null {
  for (const [key, land] of [["land_area", true], ["area", false]] as const) {
    const n = Number(specs[key]);
    if (specs[key] !== null && specs[key] !== "" && Number.isFinite(n) && n > 0) return { m2: n, land };
  }
  return null;
}

// ─── Ô thông số nổi bật ──────────────────────────────────────────────────────

/** Tối đa 4 thông số giá trị ngắn cho dải "facts" dưới tiêu đề (đủ chỗ trên một hàng). */
export function highlightFacts(rows: { k: string; v: string }[], max = 4): { k: string; v: string }[] {
  return rows.filter((r) => r.v.length <= 18).slice(0, max);
}

/** "86,5 m²" → { value: "86,5", unit: "m²" } để in đơn vị nhỏ hơn. */
export function splitUnit(v: string): { value: string; unit: string | null } {
  const m = /^(.*\d)\s(m²|m2|m|ha|km|km²)$/.exec(v);
  return m ? { value: m[1], unit: m[2] } : { value: v, unit: null };
}

// ─── Pháp lý tự khai ─────────────────────────────────────────────────────────

export type LegalTone = "ok" | "warn" | "muted";
export interface LegalItem {
  title: string;
  note: string;
  tone: LegalTone;
}

const NOT_DECLARED = "Chủ tài sản chưa khai thông tin này";
const IN_DOSSIER = "Chi tiết nêu trong hồ sơ tham gia đấu giá";

/** Bốn ô pháp lý: "có" ở câu vướng (tranh chấp / thế chấp / kê biên) là cảnh báo, chưa khai là xám. */
export function legalItems(legal: SharedPosting["legal"]): LegalItem[] {
  const flag = (v: boolean | null, topic: string, yes: [string, string], no: [string, string]): LegalItem =>
    v === null
      ? { title: `${topic}: chưa khai`, note: NOT_DECLARED, tone: "muted" }
      : v
        ? { title: yes[0], note: yes[1], tone: "warn" }
        : { title: no[0], note: no[1], tone: "ok" };
  return [
    legal.rightToSell
      ? { title: "Có quyền bán tài sản", note: "Chủ tài sản xác nhận có quyền xử lý, chuyển nhượng", tone: "ok" }
      : { title: "Quyền bán: chưa xác nhận", note: NOT_DECLARED, tone: "muted" },
    flag(legal.hasDispute, "Tranh chấp", ["Đang có tranh chấp", IN_DOSSIER], ["Không tranh chấp", "Không có khiếu nại, khởi kiện liên quan"]),
    flag(
      legal.hasMortgage,
      "Thế chấp",
      ["Đang thế chấp", "Điều kiện giải chấp nêu trong hồ sơ tham gia đấu giá"],
      ["Không thế chấp", "Tài sản không dùng để bảo đảm khoản vay"],
    ),
    flag(legal.isSeized, "Kê biên", ["Đang bị kê biên", IN_DOSSIER], ["Không bị kê biên", "Không thuộc diện thi hành án, phong tỏa"]),
  ];
}
