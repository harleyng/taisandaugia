// "Viết bằng AI" của tab Tiếp thị (design pdg-mvp3.js): tuỳ chọn bài viết + bộ viết
// bài chung / bài theo kênh. Thuần — không React, không Supabase.
//
// Hôm nay là bộ viết MẪU TẤT ĐỊNH (cùng vai trò m3Fallback của design). Hook
// useOutreachWriter là SEAM đổi sang mô hình thật; ràng buộc giữ nguyên khi đổi: chỉ
// dùng dữ liệu trong WriterContext, không bịa số liệu, không hứa lợi nhuận.

import type { ChannelKind } from "./channels";
import { CHANNEL_LIMITS } from "./channels";

export type Tone = "trang" | "than" | "ngan";
export type Length = "s" | "m" | "l";
export type Audience = "all" | "dn" | "dt" | "cn";
export type Highlight = "gia" | "phaply" | "htrang" | "vitri" | "han";
export type Extra = "emoji" | "hashtag" | "lich";

export interface WriteOptions {
  tone: Tone;
  len: Length;
  aud: Audience;
  hl: Highlight[];
  x: Extra[];
}

export const TONE_OPTS: [Tone, string][] = [
  ["trang", "Trang trọng"],
  ["than", "Thân thiện"],
  ["ngan", "Ngắn gọn, nhiều số liệu"],
];
export const LEN_OPTS: [Length, string][] = [
  ["s", "Ngắn"],
  ["m", "Vừa"],
  ["l", "Dài"],
];
export const AUD_OPTS: [Audience, string][] = [
  ["all", "Mọi khách"],
  ["dn", "Doanh nghiệp"],
  ["dt", "Nhà đầu tư"],
  ["cn", "Cá nhân"],
];
export const HIGHLIGHT_OPTS: [Highlight, string][] = [
  ["gia", "Giá khởi điểm"],
  ["phaply", "Pháp lý rõ ràng"],
  ["htrang", "Hiện trạng tốt"],
  ["vitri", "Vị trí"],
  ["han", "Hạn nộp hồ sơ"],
];
export const EXTRA_OPTS: [Extra, string][] = [
  ["emoji", "Dùng emoji"],
  ["hashtag", "Thêm hashtag"],
  ["lich", "Lịch xem tài sản"],
];

export const DEFAULT_OPTIONS: WriteOptions = { tone: "than", len: "m", aud: "all", hl: ["gia", "han"], x: ["emoji"] };

/** Kênh có tab "Viết cho" (design M3CH) — Cổng thông tin / trang tổ chức không viết lại. */
export const WRITABLE_KINDS: ChannelKind[] = ["fb", "zalo", "mail", "sms", "fbg", "zg", "web", "news"];

const pick = <T extends string>(opts: [T, string][], v: unknown, d: T): T =>
  opts.some(([k]) => k === v) ? (v as T) : d;

/** jsonb bất kỳ → tuỳ chọn hợp lệ (thiếu / hỏng ⇒ mặc định). */
export function parseOptions(raw: unknown): WriteOptions {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = <T extends string>(opts: [T, string][], v: unknown, d: T[]): T[] =>
    Array.isArray(v) ? (v.filter((x) => opts.some(([k]) => k === x)) as T[]) : d;
  return {
    tone: pick(TONE_OPTS, r.tone, DEFAULT_OPTIONS.tone),
    len: pick(LEN_OPTS, r.len, DEFAULT_OPTIONS.len),
    aud: pick(AUD_OPTS, r.aud, DEFAULT_OPTIONS.aud),
    hl: list(HIGHLIGHT_OPTS, r.hl, DEFAULT_OPTIONS.hl),
    x: list(EXTRA_OPTS, r.x, DEFAULT_OPTIONS.x),
  };
}

const label = <T extends string>(opts: [T, string][], v: T) => opts.find(([k]) => k === v)?.[1] ?? v;

/** "Thân thiện · Vừa · Mọi khách · Giá khởi điểm · Hạn nộp hồ sơ" (design m3Sum). */
export function optionsSummary(o: WriteOptions): string {
  return [label(TONE_OPTS, o.tone), label(LEN_OPTS, o.len), label(AUD_OPTS, o.aud), ...o.hl.map((h) => label(HIGHLIGHT_OPTS, h))].join(
    " · ",
  );
}

export interface WriterLot {
  lot_no: number;
  title: string;
  /** Đã định dạng; rỗng nếu chưa có. */
  starting_price: string;
  place: string;
  description: string;
  condition: string;
  legal: string;
}

export interface WriterContext {
  orgName: string;
  head: string;
  totalStart: string;
  totalDeposit: string;
  regEnd: string;
  auctionDate: string;
  viewing: string;
  province: string | null;
  lots: WriterLot[];
  link: (src: string | null) => string;
}

const firstSentence = (t: string) => {
  const s = t.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
};

const AUD_LINE: Record<Audience, string> = {
  all: "",
  dn: "Phù hợp cho doanh nghiệp có nhu cầu mở rộng sản xuất, kinh doanh.",
  dt: "Cơ hội cho nhà đầu tư tìm tài sản giá tốt qua kênh đấu giá công khai, minh bạch.",
  cn: "Phù hợp cho cá nhân, gia đình có nhu cầu sử dụng.",
};

const slugTag = (s: string) =>
  `#${s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "")}`;

export const toAscii = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

/** Bài chung nhắc đủ mọi lô (design m3Gen / m3Fallback), theo tuỳ chọn. */
export function writeSharedPost(ctx: WriterContext, o: WriteOptions, src: string | null = null): string {
  const emoji = o.x.includes("emoji");
  const has = (h: Highlight) => o.hl.includes(h);
  const n = ctx.lots.length;
  const out: string[] = [];

  if (o.tone === "trang") out.push(`THÔNG BÁO ĐẤU GIÁ TÀI SẢN\n${ctx.head}`);
  else out.push(`${emoji ? "🔔 " : ""}${ctx.head}`);

  const intro =
    o.tone === "trang"
      ? `${ctx.orgName} thông báo tổ chức đấu giá công khai ${n > 1 ? `${n} tài sản` : "tài sản"} sau:`
      : o.tone === "than"
        ? `${ctx.orgName} trân trọng giới thiệu ${n > 1 ? `${n} tài sản` : "tài sản"} đưa ra đấu giá công khai, minh bạch:`
        : `${n > 1 ? `${n} tài sản` : "Tài sản"} đấu giá:`;
  out.push([intro, o.len === "s" ? "" : AUD_LINE[o.aud]].filter(Boolean).join(" "));

  out.push(
    ctx.lots
      .map((l) => {
        const lines = [`• Lô ${l.lot_no}: ${l.title}${l.starting_price ? ` — giá khởi điểm ${l.starting_price}` : ""}`];
        if (o.len !== "s") {
          if (has("vitri") && l.place) lines.push(`  Vị trí: ${l.place}`);
          if ((has("htrang") || o.len === "l") && l.condition) lines.push(`  ${firstSentence(l.condition)}`);
          if ((has("phaply") || o.len === "l") && l.legal) lines.push(`  ${firstSentence(l.legal)}`);
          if (o.len === "l" && l.description) lines.push(`  ${firstSentence(l.description)}`);
        }
        return lines.join("\n");
      })
      .join(o.len === "s" ? "\n" : "\n\n"),
  );

  const bullet = emoji ? "▪" : "-";
  const facts = [
    has("gia") || o.tone === "ngan" ? `${bullet} Tổng giá khởi điểm: ${ctx.totalStart}` : "",
    o.len !== "s" || o.tone === "ngan" ? `${bullet} Tiền đặt trước: ${ctx.totalDeposit}` : "",
    `${bullet} Hạn nhận hồ sơ: ${ctx.regEnd}${has("han") && emoji ? " ⏰" : ""}`,
    `${bullet} Ngày đấu giá: ${ctx.auctionDate}`,
  ].filter(Boolean);
  out.push(facts.join("\n"));

  if (o.x.includes("lich")) {
    out.push(
      `Liên hệ ${ctx.orgName} để được hướng dẫn xem tài sản trước ngày đấu giá${ctx.viewing ? ` (${ctx.viewing})` : ""}.`,
    );
  }
  if (o.tone === "trang") out.push("Hồ sơ và tiền đặt trước nộp theo quy chế cuộc đấu giá.");
  else if (o.tone === "than" && o.len !== "s") out.push(`Số lượng hồ sơ có hạn — đăng ký sớm để không bỏ lỡ${has("han") ? ` trước ${ctx.regEnd}` : ""}!`);

  out.push(`${emoji ? "👉 " : ""}Đăng ký tham gia: ${ctx.link(src)}`);

  if (o.x.includes("hashtag")) {
    out.push(["#daugia", "#taisandaugia", ctx.province ? slugTag(ctx.province) : "", "#daugiacongkhai"].filter(Boolean).join(" "));
  }
  return out.filter((x) => x.trim()).join("\n\n");
}

/** Bài viết riêng cho một kênh, chuyển thể từ cùng dữ liệu (design m3GenCh). */
export function writeChannelPost(ctx: WriterContext, kind: ChannelKind, o: WriteOptions): string {
  const lim = CHANNEL_LIMITS[kind];
  if (kind === "sms") {
    const tail = `. GKD ${toAscii(ctx.totalStart)}. Han HS ${ctx.regEnd}. DK: ${ctx.link("sms")}`;
    const room = Math.max(20, 160 - tail.length);
    return `${toAscii(ctx.head).slice(0, room)}${tail}`;
  }
  if (kind === "mail") {
    const body = writeSharedPost(ctx, { ...o, x: o.x.filter((x) => x !== "hashtag" && x !== "emoji") }, "mail")
      .split("\n\n")
      .slice(1)
      .join("\n\n");
    const greet = o.tone === "trang" ? "Kính gửi Quý khách," : "Chào Quý khách,";
    return `Tiêu đề: [Đấu giá] ${ctx.head}\n\n${greet}\n\n${body}\n\nTrân trọng,\n${ctx.orgName}`;
  }
  if (kind === "zalo" || kind === "zg") {
    const text = writeSharedPost(ctx, { ...o, len: "s", x: o.x.filter((x) => x !== "hashtag") }, kind);
    return lim && text.length > lim ? `${text.slice(0, lim - 1)}…` : text;
  }
  const tuned: WriteOptions =
    kind === "news" ? { ...o, tone: "trang", x: o.x.filter((x) => x === "lich") } : kind === "fbg" ? { ...o, x: o.x.filter((x) => x !== "hashtag") } : o;
  const text = writeSharedPost(ctx, tuned, kind);
  return lim && text.length > lim ? `${text.slice(0, lim - 1)}…` : text;
}
