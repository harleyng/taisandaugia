// Khoá trường của gói tiếp thị (session_outreach_fields.field_key).
// FIELD_KEY_PATTERN phải TRÙNG NGUYÊN VĂN với CHECK trong
// supabase/migrations/20260912000013_session_outreach.sql — fieldKeys.test.ts đọc
// file migration để kiểm.

export const CHANNEL_KEYS = ["listing", "zalo", "facebook", "sms", "flyer"] as const;
export type ChannelKey = (typeof CHANNEL_KEYS)[number];

export const CHANNEL_LABELS: Record<ChannelKey, string> = {
  listing: "Tin đăng",
  zalo: "Bài Zalo",
  facebook: "Bài Facebook",
  sms: "Tin nhắn SMS",
  flyer: "Tờ rơi",
};

/** 'lot:<uuid lô>' khi khách khớp đúng một lô, 'multi' khi khớp từ hai lô. Do SQL tính. */
export type SegmentKey = `lot:${string}` | "multi";

export const FIELD_KEY_PATTERN =
  "^(channel:(listing|zalo|facebook|sms|flyer)|notice:[a-z0-9_]+|pitch:(lot:[0-9a-f-]{36}|multi))$";
const FIELD_KEY_RE = new RegExp(FIELD_KEY_PATTERN);

export const channelFieldKey = (c: ChannelKey) => `channel:${c}`;
export const noticeFieldKey = (slot: string) => `notice:${slot}`;
export const pitchFieldKey = (segment: SegmentKey) => `pitch:${segment}`;

export type ParsedFieldKey =
  | { kind: "channel"; channel: ChannelKey }
  | { kind: "notice"; slot: string }
  | { kind: "pitch"; segment: SegmentKey };

export function isFieldKey(key: string): boolean {
  return FIELD_KEY_RE.test(key);
}

export function parseFieldKey(key: string): ParsedFieldKey | null {
  if (!isFieldKey(key)) return null;
  const [kind, ...rest] = key.split(":");
  const tail = rest.join(":");
  if (kind === "channel") return { kind, channel: tail as ChannelKey };
  if (kind === "notice") return { kind, slot: tail };
  return { kind: "pitch", segment: tail as SegmentKey };
}
