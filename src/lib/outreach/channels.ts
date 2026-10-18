// Kênh đăng tin của tab Tiếp thị (design pdg-mk2.js `MKT` / `MKL`).
// Bảng: session_outreach_channels (supabase/migrations/20261018120000_session_outreach_v2.sql)
// — ChannelKind phải trùng CHECK của cột kind.

export type ChannelKind = "cong" | "san" | "fb" | "zalo" | "mail" | "web" | "news" | "fbg" | "zg" | "sms" | "other";

/** Màu ô chữ viết tắt. Design có thêm tím (vio) — không có token ⇒ Facebook dùng xanh dương. */
export type MonoTone = "pri" | "blu" | "warn";

export const CHANNEL_META: Record<ChannelKind, { label: string; mono: string; tone: MonoTone }> = {
  cong: { label: "Cổng thông tin quốc gia", mono: "CT", tone: "blu" },
  san: { label: "Trang tổ chức", mono: "TC", tone: "pri" },
  fb: { label: "Facebook", mono: "FB", tone: "blu" },
  zalo: { label: "Zalo OA", mono: "ZL", tone: "blu" },
  mail: { label: "Email", mono: "@", tone: "warn" },
  web: { label: "Website tổ chức", mono: "WB", tone: "pri" },
  news: { label: "Báo điện tử", mono: "BĐ", tone: "warn" },
  fbg: { label: "Nhóm Facebook", mono: "NF", tone: "blu" },
  zg: { label: "Nhóm Zalo", mono: "NZ", tone: "blu" },
  sms: { label: "SMS", mono: "SM", tone: "pri" },
  other: { label: "Kênh khác", mono: "+", tone: "pri" },
};

/** Giới hạn ký tự bài theo kênh. */
export const CHANNEL_LIMITS: Partial<Record<ChannelKind, number>> = { sms: 320, zalo: 2000, zg: 2000, fb: 5000, fbg: 5000 };

export interface OutreachChannel {
  id: string;
  pack_id: string;
  kind: ChannelKind;
  name: string;
  target: string;
  /** true ⇒ kênh có bài riêng (custom_body), không theo bài chung. */
  own_content: boolean;
  custom_head: string;
  custom_body: string;
  custom_cta: string;
  scheduled_at: string | null;
  sort_order: number;
  /** Tuỳ chọn viết riêng của kênh; null = theo bài chung. */
  post_options: unknown;
}

/** Liên kết đăng ký gắn mã nguồn kênh (?src=) để đếm hồ sơ đến từ kênh. */
export function registrationLink(origin: string, sessionId: string, src?: string | null): string {
  return `${origin}/sessions/${sessionId}${src ? `?src=${src}` : ""}`;
}
