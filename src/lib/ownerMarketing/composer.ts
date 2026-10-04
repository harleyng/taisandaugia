// Trình soạn chiến dịch truyền thông (Phase M2) — thuần, tất định.
//
// Ranh giới (cùng tinh thần src/lib/outreach/generateOutreach.ts):
//  • Dữ kiện (giá, đặt trước, hạn, giờ, tổ chức) CHỈ đọc từ snapshot server dựng; mỗi
//    văn bản xuất = phần mô tả người dùng sửa + khối dữ kiện KHOÁ + link theo dõi.
//    Người dùng không có ô nào để gõ dữ kiện.
//  • Không bao giờ dùng mô tả tự do của tin hay tên người vay / người có tài sản: câu
//    mô tả gợi ý dựng từ loại tài sản, diện tích, vị trí.
//  • Tài sản chưa có phiên công bố (announced=false): khối dữ kiện bỏ giá / hạn / giờ
//    (quyết định D4) và nói lý do.

import { categoryLabel } from "@/lib/orgContacts/interestLabel";
import { excerpt } from "@/lib/outreach/generateOutreach";
import { shortDate, viDateTime, viRange, vnd, vndAscii } from "@/lib/outreach/format";
import { AUCTION_FORMAT_TEXT } from "@/lib/outreach/outreachInput";
import { composeSms, stripDiacritics } from "@/lib/outreach/sms";
import { type AssetFacts, type CampaignChannel, type CampaignDrafts, DRAFT_LIMITS, type FactsSnapshot } from "./campaigns";

/** Chèn vào chỗ link khi chiến dịch chưa duyệt (chưa có link theo dõi). */
export const LINK_PLACEHOLDER = "[link theo dõi — tạo khi được duyệt]";
export const FACTS_SOURCE_NOTE = "Thông tin chính thức theo thông báo đấu giá của tổ chức đấu giá tài sản.";
export const NOT_ANNOUNCED_NOTE =
  "Chưa có phiên đấu giá được công bố: giá khởi điểm, tiền đặt trước và các mốc thời gian chỉ hiển thị khi tổ chức đấu giá công bố.";

// ─── Mô tả tài sản ───────────────────────────────────────────────────────────

export function kindLabel(a: Pick<AssetFacts, "category_slug">): string | null {
  if (!a.category_slug) return null;
  const l = categoryLabel(a.category_slug);
  return l && l !== a.category_slug ? l : null;
}

export const areaText = (a: Pick<AssetFacts, "area">) =>
  a.area != null && a.area > 0 ? `${a.area.toLocaleString("en-US", { maximumFractionDigits: 1 })} m²` : "";

export const placeText = (a: Pick<AssetFacts, "district" | "province">) =>
  [a.district && a.district !== "Trung tâm" ? a.district : null, a.province].filter(Boolean).join(", ");

// ─── Khối dữ kiện khoá ───────────────────────────────────────────────────────

export interface FactLine {
  label: string;
  value: string;
}

/** Dòng dữ kiện của một tài sản theo đúng thứ tự hiển thị. Ô trống bị bỏ. */
export function factLines(a: AssetFacts): FactLine[] {
  const lines: FactLine[] = [
    { label: "Loại tài sản", value: kindLabel(a) ?? "" },
    { label: "Diện tích", value: areaText(a) },
    { label: "Vị trí", value: placeText(a) },
  ];
  if (a.announced) {
    lines.push(
      { label: "Giá khởi điểm", value: a.starting_price != null ? vnd(a.starting_price) : "" },
      { label: "Tiền đặt trước", value: a.deposit != null ? vnd(a.deposit) : "" },
      { label: "Bước giá", value: a.bid_step != null ? vnd(a.bid_step) : "" },
      { label: "Tiền mua hồ sơ", value: a.dossier_fee != null ? vnd(a.dossier_fee) : "" },
      { label: "Xem tài sản", value: viRange(a.viewing_start_at, a.viewing_end_at) },
      { label: "Hạn đăng ký", value: a.registration_end_at ? viDateTime(a.registration_end_at) : "" },
      { label: "Thời gian đấu giá", value: a.auction_at ? viDateTime(a.auction_at) : "" },
      { label: "Địa điểm đấu giá", value: a.venue ?? "" },
      { label: "Hình thức", value: a.auction_format ? (AUCTION_FORMAT_TEXT[a.auction_format] ?? "") : "" },
      {
        label: "Mã phiên",
        value: a.session_code ? `${a.session_code}${a.lot_no != null ? ` · lô ${a.lot_no}` : ""}` : "",
      },
    );
  }
  lines.push({
    label: "Tổ chức đấu giá",
    value: [a.org_name, a.org_phone].filter(Boolean).join(" — "),
  });
  return lines.filter((l) => l.value.trim());
}

// ─── Gợi ý phần mô tả ────────────────────────────────────────────────────────

const assetPhrase = (a: AssetFacts) => {
  const kind = kindLabel(a)?.toLowerCase() ?? "tài sản";
  const area = areaText(a);
  const place = placeText(a);
  return `${kind}${area ? ` ${area}` : ""}${place ? ` tại ${place}` : ""}`;
};

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** Bản nháp gợi ý cho mọi kênh. Không chứa giá / ngày — những thứ đó nằm ở khối khoá. */
export function suggestDrafts(facts: FactsSnapshot): CampaignDrafts {
  const assets = facts.assets;
  if (!assets.length) return { email: { subject: "", body: "" }, zalo: { body: "" }, facebook: { body: "" }, sms: { body: "" } };
  const one = assets.length === 1 ? assets[0] : null;
  const provinces = uniq(assets.map((a) => a.province).filter((p): p is string => !!p));
  const where = provinces.length ? provinces.slice(0, 3).join(", ") : "";

  const headline = one
    ? `Cơ hội sở hữu ${assetPhrase(one)} qua đấu giá công khai.`
    : `${assets.length} tài sản đấu giá công khai${where ? ` tại ${where}` : ""}.`;
  const detail = one
    ? "Tài sản được bán đấu giá minh bạch theo quy định; người mua đăng ký tham gia trực tiếp với tổ chức đấu giá."
    : `Gồm: ${assets.map(assetPhrase).join("; ")}.`;

  const subject = excerpt(
    one ? `Tài sản đấu giá: ${one.title}` : `${assets.length} tài sản đấu giá${where ? ` tại ${where}` : ""}`,
    DRAFT_LIMITS.subject,
  );

  const smsTeaser = (() => {
    const a = assets[0];
    const kind = stripDiacritics(kindLabel(a) ?? "Tai san");
    const area = a.area != null && a.area > 0 ? ` ${Math.round(a.area)}m2` : "";
    const place = a.province ? ` ${stripDiacritics(a.province)}` : "";
    const base = one ? `${kind}${area}${place}` : `${assets.length} tai san dau gia${place}`;
    return base.replace(/[^\x20-\x7E]/g, "").slice(0, DRAFT_LIMITS.sms);
  })();

  return {
    email: {
      subject,
      body: `Kính gửi Quý khách,\n\n${headline} ${detail}\n\nThông tin chi tiết và hướng dẫn đăng ký ở bên dưới.`,
    },
    zalo: { body: `${headline}\n${detail}` },
    facebook: { body: `📢 ${headline}\n\n${detail}\n\nMời Quý khách xem chi tiết và đăng ký tham gia theo hướng dẫn bên dưới.` },
    sms: { body: smsTeaser },
  };
}

// ─── Văn bản xuất theo kênh ──────────────────────────────────────────────────

/** id tài sản (tin / hồ sơ) → URL link Hồ sơ online của kênh đang dựng. Thiếu ⇒ chỗ giữ link. */
export type LinkMap = Record<string, string | undefined>;

const linkOf = (links: LinkMap | null, assetId: string) => links?.[assetId] ?? LINK_PLACEHOLDER;

function factBlock(a: AssetFacts, bullet: string): string {
  const lines = factLines(a).map((l) => `${bullet}${l.label}: ${l.value}`);
  if (!a.announced) lines.push(`${bullet}${NOT_ANNOUNCED_NOTE}`);
  return lines.join("\n");
}

function assetsBlock(facts: FactsSnapshot, links: LinkMap | null, style: "chat" | "plain"): string {
  return facts.assets
    .map((a, i) => {
      const head = style === "chat" ? `🏠 ${a.title}` : `${facts.assets.length > 1 ? `${i + 1}. ` : ""}${a.title}`;
      const link = style === "chat" ? `👉 Chi tiết: ${linkOf(links, a.asset_id)}` : `Chi tiết: ${linkOf(links, a.asset_id)}`;
      return [head, factBlock(a, "• "), link].join("\n");
    })
    .join("\n\n");
}

export interface ChannelText {
  /** Chỉ Email có tiêu đề. */
  subject?: string;
  /** SMS: mỗi tài sản một tin; các kênh khác một văn bản. */
  texts: string[];
}

/**
 * Văn bản hoàn chỉnh của một kênh: mô tả (sửa được) + dữ kiện khoá + link theo dõi.
 * `senderShort` là tên ngắn của đơn vị ở đầu SMS (đã bỏ dấu khi ghép).
 */
export function renderChannel(
  channel: CampaignChannel,
  facts: FactsSnapshot,
  drafts: CampaignDrafts,
  links: LinkMap | null,
  senderShort: string,
): ChannelText {
  const join = (parts: string[]) => parts.filter((p) => p.trim()).join("\n\n");
  switch (channel) {
    case "email":
      return {
        subject: drafts.email.subject.trim(),
        texts: [join([drafts.email.body.trim(), assetsBlock(facts, links, "plain"), FACTS_SOURCE_NOTE])],
      };
    case "zalo":
      return { texts: [join([drafts.zalo.body.trim(), assetsBlock(facts, links, "chat"), FACTS_SOURCE_NOTE])] };
    case "facebook": {
      const tags = uniq(
        ["#daugiataisan", ...facts.assets.map((a) => (a.province ? `#${stripDiacritics(a.province).toLowerCase().replace(/[^a-z0-9]+/g, "")}` : ""))].filter(
          Boolean,
        ),
      ).join(" ");
      return { texts: [join([drafts.facebook.body.trim(), assetsBlock(facts, links, "chat"), FACTS_SOURCE_NOTE, tags])] };
    }
    case "sms":
      return {
        texts: facts.assets.map((a) =>
          composeSms({
            lead: `[${senderShort}]`,
            subject: drafts.sms.body,
            details: a.announced
              ? [
                  a.starting_price != null ? `gia KD ${vndAscii(a.starting_price)}` : "",
                  a.registration_end_at ? `han DK ${shortDate(a.registration_end_at)}` : "",
                  a.auction_at ? `DG ${shortDate(a.auction_at)}` : "",
                ]
              : [],
            link: linkOf(links, a.asset_id) === LINK_PLACEHOLDER ? "[link]" : linkOf(links, a.asset_id),
          }),
        ),
      };
  }
}

/** Tên ngắn không dấu cho đầu SMS: viết tắt đầu tiên của đơn vị, không có thì rút từ tên. */
export function smsSenderShort(workspace: { abbreviations?: string[] | null; primary_name?: string | null } | null): string {
  const abbr = workspace?.abbreviations?.find((x) => x.trim());
  const raw = abbr || workspace?.primary_name || "Thong bao";
  return stripDiacritics(raw)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/ngan hang|tmcp|thuong mai co phan|chi nhanh/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16) || "Thong bao";
}

// ─── Tờ rơi ──────────────────────────────────────────────────────────────────

/** Văn bản tờ rơi cho printFlyer: dòng 3 là tiêu đề lớn, dòng VIẾT HOA là tiêu đề mục. */
export function renderFlyer(campaignName: string, senderName: string, facts: FactsSnapshot, drafts: CampaignDrafts, links: LinkMap | null): string {
  const lines: string[] = [senderName.toUpperCase(), "TÀI SẢN ĐẤU GIÁ", campaignName, ""];
  const intro = drafts.zalo.body.trim() || drafts.facebook.body.trim() || drafts.email.body.trim();
  if (intro) lines.push(intro, "");
  facts.assets.forEach((a, i) => {
    lines.push(`TÀI SẢN ${facts.assets.length > 1 ? i + 1 : ""}`.trim(), a.title, factBlock(a, "• "), `Xem chi tiết: ${linkOf(links, a.asset_id)}`, "");
  });
  lines.push(FACTS_SOURCE_NOTE);
  return lines.join("\n");
}

// ─── Dữ kiện đổi sau khi duyệt ───────────────────────────────────────────────

/**
 * Dữ kiện hiện tại khác bản đã chụp lúc gửi duyệt? (vd. phiên mới với giá khởi điểm
 * thấp hơn). So theo đúng các dòng hiển thị, nên đổi ảnh / mô tả tin không tính.
 */
export function factsDiffer(snapshot: FactsSnapshot, current: FactsSnapshot): boolean {
  const key = (f: FactsSnapshot) =>
    JSON.stringify(f.assets.map((a) => [a.asset_id, a.announced, factLines(a)]));
  return key(snapshot) !== key(current);
}
