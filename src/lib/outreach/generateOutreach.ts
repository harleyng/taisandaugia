// TRÌNH SOẠN gói tiếp thị — engine thuần, tất định (seededRand).
//
// Ranh giới trách nhiệm:
//  • Chỉ viết văn mô tả quanh dữ kiện có sẵn: kênh đăng tin, 2 ô 'draft' của thông
//    báo, câu chào theo phân khúc. KHÔNG trả về câu chữ điều khoản — kiểu trả về
//    của draftSlots chỉ có DraftSlotKey.
//  • Không bịa dữ kiện: giá, giờ, địa điểm, tên lô đều đọc từ OutreachInput.
//  • Kênh không nhắc lại điều khoản thông báo; chỉ trỏ tới thông báo + trang phiên.

import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { categoryLabel } from "@/lib/orgContacts/interestLabel";
import { seededPick } from "@/lib/seededRand";
import { caseLot } from "./caseFile";
import { CHANNEL_KEYS, channelFieldKey, noticeFieldKey, pitchFieldKey, type ChannelKey, type SegmentKey } from "./fieldKeys";
import { shortDate, viDateTime, viRange, vnd, vndAscii } from "./format";
import { CATEGORY_ANGLE, CLOSERS, MODEL_LABEL, OPENERS, PITCH_MULTI, PITCH_ONE } from "./mockOutreach";
import type { DraftSlotKey } from "./noticeTemplate";
import {
  AUCTION_FORMAT_TEXT,
  lotPlace,
  outreachSignature,
  sortedLots,
  type OutreachInput,
  type OutreachLot,
} from "./outreachInput";
import { composeSms, stripDiacritics } from "./sms";

export interface OutreachDraft {
  channels: Record<ChannelKey, string>;
  draftSlots: Record<DraftSlotKey, string>;
  pitches: Partial<Record<SegmentKey, string>>;
  signature: string;
  modelLabel: string;
}

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
const bullets = (lines: string[]) => lines.filter(Boolean).map((l) => `• ${l}`).join("\n");
const section = (title: string, lines: string[]) => (lines.some(Boolean) ? `${title}\n${bullets(lines)}` : "");
const paragraphs = (blocks: string[]) => blocks.filter((b) => b.trim()).join("\n\n");
const noDot = (s: string) => s.trim().replace(/[.。]+$/, "");

export const excerpt = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

export const parentSlugOf = (slug: string | null | undefined): string | null =>
  slug ? (ASSET_CATEGORIES.find((p) => p.slug === slug || p.children.some((c) => c.slug === slug))?.slug ?? null) : null;

/** "Công ty Đấu giá Hợp danh Bảo Tín" → "Bảo Tín" — dùng cho đầu SMS. */
export function shortOrgName(name: string): string {
  const stripped = name
    .replace(/chi nhánh|công ty|cổ phần|tnhh|hợp danh|đấu giá|tài sản|dịch vụ|tại\s.+$/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return excerpt(stripped || name, 20);
}

const hashtag = (s: string | null | undefined) =>
  s ? `#${stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, "")}` : "";

export function generateOutreach(input: OutreachInput): OutreachDraft {
  const { session: s, org } = input;
  const lots = sortedLots(input.lots);
  const seed = `${s.id}:${s.code ?? ""}`;
  const code = s.code ?? "";
  const what = lots.length === 1 ? lots[0].title : `${lots.length} tài sản`;
  const vars = { org: org.name, title: s.title, what, code, phone: org.phone ?? "tổ chức" };
  const pickT = <T extends readonly string[]>(pool: T, salt: string) => fill(seededPick(pool, seed, salt) ?? pool[0], vars);

  const lotLine = (l: OutreachLot) => {
    const place = lotPlace(l);
    const price = l.starting_price != null ? `giá khởi điểm ${vnd(l.starting_price)}` : "giá khởi điểm theo thông báo đấu giá";
    return `Lô ${l.lot_no}: ${l.title}${place ? ` (${place})` : ""} — ${price}`;
  };
  const schedule = [
    s.viewing_start_at || s.viewing_end_at ? `Xem tài sản: ${viRange(s.viewing_start_at, s.viewing_end_at)}` : "",
    s.registration_start_at || s.registration_end_at
      ? `Nhận hồ sơ: ${viRange(s.registration_start_at, s.registration_end_at)}`
      : "",
    `Tổ chức đấu giá: ${viDateTime(s.starts_at)}${s.venue ? ` tại ${s.venue}` : ""}`,
  ];
  const deposits = lots.filter((l) => l.deposit_amount != null);
  const participation = [
    deposits.length ? `Tiền đặt trước: ${deposits.map((l) => `Lô ${l.lot_no} ${vnd(l.deposit_amount)}`).join("; ")}` : "",
    s.dossier_fee != null ? `Tiền mua hồ sơ: ${vnd(s.dossier_fee)}` : "",
    AUCTION_FORMAT_TEXT[s.auction_format] ? `Hình thức: ${AUCTION_FORMAT_TEXT[s.auction_format]}` : "",
  ];
  const contact = [org.phone ? `Hotline ${org.phone}` : "", input.caseFile.contact_person.trim()].filter(Boolean).join(" — ");
  const contactLine = `Liên hệ: ${org.name}${contact ? ` — ${contact}` : ""}`;
  const highlights = lots
    .map((l) => {
      const d = caseLot(input.caseFile, l.id).description.trim();
      return d ? `Lô ${l.lot_no}: ${excerpt(d, 220)}` : "";
    })
    .filter(Boolean);
  const parent = parentSlugOf(lots[0]?.category_slug);
  const angle = CATEGORY_ANGLE[parent ?? "default"] ?? CATEGORY_ANGLE.default;
  const legalPointer = `Thông tin pháp lý chính thức theo thông báo đấu giá của ${org.name} (mã phiên ${code}).`;
  const link = `Chi tiết & đăng ký: ${input.publicUrl}`;
  const prices = lots.map((l) => l.starting_price).filter((p): p is number => p != null);
  const minPrice = prices.length ? Math.min(...prices) : null;

  const listing = paragraphs([
    `${s.title} — mã phiên ${code}`,
    pickT(OPENERS.listing, "listing"),
    section("Tài sản đấu giá:", lots.map(lotLine)),
    section("Điểm nổi bật:", highlights),
    section("Lịch phiên:", schedule),
    section("Tham gia:", participation),
    angle,
    legalPointer,
    link,
    contactLine,
  ]);

  const zalo = paragraphs([
    pickT(OPENERS.zalo, "zalo"),
    `${s.title} (mã ${code})`,
    bullets(lots.map((l) => `Lô ${l.lot_no}: ${l.title}${l.starting_price != null ? ` — ${vnd(l.starting_price)}` : ""}`)),
    [
      s.viewing_start_at ? `🗓 Xem tài sản từ ${viDateTime(s.viewing_start_at)}` : "",
      s.registration_end_at ? `📝 Nhận hồ sơ đến ${viDateTime(s.registration_end_at)}` : "",
      `🔨 Đấu giá ${viDateTime(s.starts_at)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    `👉 ${link}`,
    `☎️ ${org.name}${org.phone ? ` — ${org.phone}` : ""}`,
    pickT(CLOSERS.zalo, "zalo-closer"),
  ]);

  const facebook = paragraphs([
    pickT(OPENERS.facebook, "facebook"),
    angle,
    section("Tài sản đấu giá:", lots.map(lotLine)),
    section("Điểm nổi bật:", highlights),
    section("Lịch phiên:", schedule),
    section("Tham gia:", participation),
    legalPointer,
    link,
    contactLine,
    pickT(CLOSERS.facebook, "facebook-closer"),
    ["#daugiataisan", hashtag(parent ? categoryLabel(parent) : null), hashtag(lots[0]?.province ?? s.province)]
      .filter(Boolean)
      .join(" "),
  ]);

  const sms = composeSms({
    lead: `[${shortOrgName(org.name)}] ${code}:`,
    subject: what,
    details: [
      minPrice != null ? `gia KD tu ${vndAscii(minPrice)}` : "",
      s.viewing_start_at ? `xem TS ${shortDate(s.viewing_start_at)}` : "",
      `DG ${shortDate(s.starts_at)}`,
    ],
    link: input.publicUrl,
  });

  const flyer = [
    org.name.toUpperCase(),
    `PHIÊN ĐẤU GIÁ ${code}`,
    s.title,
    "",
    "TÀI SẢN",
    bullets(
      lots.map((l) => {
        const d = caseLot(input.caseFile, l.id).description.trim();
        return `${lotLine(l)}${d ? `\n  ${excerpt(d, 160)}` : ""}`;
      }),
    ),
    "",
    "LỊCH PHIÊN",
    bullets(schedule),
    "",
    "THAM GIA",
    bullets(participation.filter(Boolean).length ? participation : ["Theo hồ sơ tham gia đấu giá"]),
    "",
    "LIÊN HỆ",
    bullets([org.name, org.address ?? "", contact]),
    "",
    legalPointer,
    `Xem chi tiết: ${input.publicUrl}`,
  ].join("\n");

  const draftSlots: Record<DraftSlotKey, string> = {
    asset_description: lots
      .map((l) => {
        const kind = l.category_slug ? categoryLabel(l.category_slug) : "";
        const extra = caseLot(input.caseFile, l.id).description.trim();
        const head = `Lô ${l.lot_no}: ${noDot(l.title)}${kind ? ` (${kind.toLowerCase()})` : ""}.`;
        return extra ? `${head} ${extra}` : head;
      })
      .join("\n"),
    asset_condition: lots
      .map((l) => {
        const c = noDot(caseLot(input.caseFile, l.id).condition);
        return `Lô ${l.lot_no}: ${c || "tài sản được giới thiệu theo hiện trạng thực tế tại thời điểm xem tài sản"}.`;
      })
      .join("\n"),
  };

  const pitches: Partial<Record<SegmentKey, string>> = {};
  for (const seg of new Set(input.segments)) {
    if (seg === "multi") {
      pitches[seg] = fill(seededPick(PITCH_MULTI, seed, "multi") ?? PITCH_MULTI[0], {
        ...vars,
        minPrice: minPrice != null ? vnd(minPrice) : "theo thông báo",
        date: shortDate(s.starts_at),
      });
      continue;
    }
    const lot = lots.find((l) => `lot:${l.id}` === seg);
    if (!lot) continue;
    const place = lotPlace(lot);
    pitches[seg] = fill(seededPick(PITCH_ONE, seed, seg) ?? PITCH_ONE[0], {
      ...vars,
      title: lot.title,
      place: place ? ` tại ${place}` : "",
      price: lot.starting_price != null ? vnd(lot.starting_price) : "theo thông báo",
      kind: lot.category_slug ? categoryLabel(lot.category_slug).toLowerCase() : "tài sản",
      date: shortDate(s.starts_at),
    });
  }

  return {
    channels: { listing, zalo, facebook, sms, flyer },
    draftSlots,
    pitches,
    signature: outreachSignature(input),
    modelLabel: MODEL_LABEL,
  };
}

/** Bản nháp → map field_key → giá trị, đúng dạng RPC outreach_apply_generation nhận. */
export function draftFieldValues(draft: OutreachDraft): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of CHANNEL_KEYS) out[channelFieldKey(c)] = draft.channels[c];
  for (const [slot, value] of Object.entries(draft.draftSlots)) out[noticeFieldKey(slot)] = value;
  for (const [seg, value] of Object.entries(draft.pitches)) if (value) out[pitchFieldKey(seg as SegmentKey)] = value;
  return out;
}
