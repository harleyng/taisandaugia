// "Tải bộ tư liệu" của chiến dịch đã duyệt (Phase M2): một file .zip gồm nội dung từng
// kênh (đã ghép link Hồ sơ online), danh sách link, tờ rơi HTML in được và ảnh tài sản.
// Ảnh tải không được (CORS / mạng) thì bỏ qua — tư liệu chữ vẫn đủ để gửi.

import JSZip from "jszip";
import { saveAs } from "file-saver";
import { flyerHtml } from "@/lib/outreach/printFlyer";
import { stripDiacritics } from "@/lib/outreach/sms";
import { CAMPAIGN_CHANNEL_META, type CampaignRow } from "./campaigns";
import { renderChannel, renderFlyer, type LinkMap } from "./composer";
import { sharedPostingUrl } from "@/lib/postingShare/message";
import type { PostingShareLink } from "@/lib/postingShare/types";
import { channelLabel } from "./links";

/** Link Hồ sơ online lần duyệt đã tạo (owner_share_links lọc theo chiến dịch). */
export type KitLink = Pick<PostingShareLink, "code" | "channel" | "postingId" | "listingId" | "targetTitle">;

export const fileSlug = (s: string) =>
  stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "chien-dich";

/** id tài sản (tin / hồ sơ) → URL theo từng kênh, từ link mà lần duyệt đã tạo. Thiếu mã ⇒ bỏ. */
export function linkMapsByChannel(links: readonly KitLink[], origin?: string): Record<string, LinkMap> {
  const out: Record<string, LinkMap> = {};
  for (const l of links) {
    const assetId = l.postingId ?? l.listingId;
    if (!l.code || !assetId) continue;
    (out[l.channel] ??= {})[assetId] = sharedPostingUrl(l.code, origin);
  }
  return out;
}

const extOf = (url: string, type: string) =>
  /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : /\.png($|\?)/i.test(url) ? "png" : "jpg";

export async function downloadMediaKit(
  c: CampaignRow,
  links: readonly KitLink[],
  senderName: string,
  senderShort: string,
): Promise<{ images: number; missedImages: number }> {
  const zip = new JSZip();
  const maps = linkMapsByChannel(links);

  for (const ch of c.channels) {
    const r = renderChannel(ch, c.facts, c.drafts, maps[ch] ?? {}, senderShort);
    const body = [r.subject ? `Tiêu đề: ${r.subject}` : "", ...r.texts].filter(Boolean).join("\n\n────────\n\n");
    zip.file(`noi-dung/${ch}-${fileSlug(CAMPAIGN_CHANNEL_META[ch].label)}.txt`, body);
  }

  zip.file(
    "link-ho-so-online.txt",
    links
      .filter((l) => l.code)
      .map((l) => `${channelLabel(l.channel)} · ${l.targetTitle}\n${sharedPostingUrl(l.code!)}`)
      .join("\n\n"),
  );

  // Tờ rơi dùng link của kênh "khác" không có ⇒ ưu tiên Zalo, rồi kênh đầu tiên.
  const flyerLinks = maps.zalo ?? maps[c.channels[0]] ?? null;
  zip.file("to-roi.html", flyerHtml(renderFlyer(c.name, senderName, c.facts, c.drafts, flyerLinks), c.name));

  let images = 0;
  let missedImages = 0;
  await Promise.all(
    c.facts.assets.map(async (a, i) => {
      if (!a.image_url) return;
      try {
        const res = await fetch(a.image_url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        zip.file(`anh/${i + 1}-${fileSlug(a.title)}.${extOf(a.image_url, blob.type)}`, blob);
        images++;
      } catch {
        missedImages++;
      }
    }),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `bo-tu-lieu-${fileSlug(c.name)}.zip`);
  return { images, missedImages };
}
