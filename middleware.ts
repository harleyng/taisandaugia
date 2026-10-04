// Vercel Routing Middleware — thẻ xem trước link (Open Graph) cho Hồ sơ online /hs/:code.
//
// App là SPA: bot của Zalo / Facebook… không chạy JS nên chỉ thấy <meta> chung của index.html.
// Với User-Agent khớp danh sách, middleware gọi RPC công khai get_shared_posting (visitor
// 'crawler' — server KHÔNG tính lượt xem) rồi trả CHÍNH index.html đã thay thẻ og:* / title.
// Không trả trang rút gọn: trình duyệt trong app Zalo cũng có chữ "Zalo" trong User-Agent, nên
// người thật bị nhận nhầm vẫn chạy được SPA bình thường. Mọi request khác (bản in /hs/:code/in,
// thiếu biến môi trường) đi thẳng tới SPA. Không dùng thư viện ngoài.
//
// Biến môi trường (Vercel → Settings → Environment Variables, KHÔNG có tiền tố VITE_):
//   OG_SUPABASE_URL       https://<project-ref>.supabase.co
//   OG_SUPABASE_ANON_KEY  khoá anon / publishable (cùng khoá client đang dùng)

export const config = { matcher: ["/hs/:path*"] };

// Googlebot cố ý không có: trang noindex, không cần thẻ riêng cho máy tìm kiếm.
const CRAWLER_UA =
  /facebookexternalhit|Facebot|Zalo|Twitterbot|Slackbot|TelegramBot|WhatsApp|LinkedInBot|Discordbot|SkypeUriPreview|Viber/i;

const SITE_NAME = "Tài Sản Đấu Giá";

/** Cho request đi tiếp tới SPA (tương đương next() của @vercel/functions). */
const passThrough = () => new Response(null, { headers: { "x-middleware-next": "1" } });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function shortMoney(v: unknown): string | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `${(Math.round(n / 1e8) / 10).toLocaleString("en-US")} tỷ`;
  if (n >= 1e6) return `${(Math.round(n / 1e5) / 10).toLocaleString("en-US")} tr`;
  return `${Math.round(n).toLocaleString("en-US")} ₫`;
}

function areaText(specs: Record<string, unknown> | undefined): string | null {
  for (const key of ["area", "land_area", "floor_area", "built_area"]) {
    const n = Number(specs?.[key]);
    if (Number.isFinite(n) && n > 0) return `${n.toLocaleString("en-US")} m²`;
  }
  return null;
}

interface OgCard {
  title: string;
  description: string;
  image: string | null;
  url: string;
}

function ogTags(card: OgCard): string {
  const t = esc(card.title);
  const d = esc(card.description);
  const u = esc(card.url);
  const img = card.image ? esc(card.image) : null;
  return `<title>${t}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
${img ? `<meta property="og:image" content="${img}">` : ""}
<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${img ? `<meta name="twitter:image" content="${img}">` : ""}`;
}

/**
 * index.html của SPA với thẻ của hồ sơ thay cho title / description / og:* / twitter:* chung.
 * Không lấy được index.html ⇒ trang tí hon chỉ có thẻ + link (bot vẫn đọc được).
 */
async function ogHtml(card: OgCard, origin: string): Promise<Response> {
  const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" };
  try {
    const res = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const html = (await res.text())
        .replace(/<title>[\s\S]*?<\/title>/i, "")
        .replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>/gi, "")
        .replace(/<head([^>]*)>/i, `<head$1>\n${ogTags(card)}`);
      return new Response(html, { headers });
    }
  } catch {
    // rơi xuống trang tí hon
  }
  const body = `<!doctype html><html lang="vi"><head><meta charset="utf-8">${ogTags(card)}</head><body><a href="${esc(card.url)}">${esc(card.title)}</a></body></html>`;
  return new Response(body, { headers });
}

const GENERIC = (url: string): OgCard => ({
  title: `Hồ sơ tài sản · ${SITE_NAME}`,
  description: "Hồ sơ số hoá tài sản đấu giá — ảnh, thông số, pháp lý và lịch phiên.",
  image: null,
  url,
});

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") ?? "";
  const match = url.pathname.match(/^\/hs\/([A-Za-z0-9_-]{12})\/?$/);
  const base = process.env.OG_SUPABASE_URL;
  const key = process.env.OG_SUPABASE_ANON_KEY;
  if (!match || !CRAWLER_UA.test(ua) || !base || !key) return passThrough();

  const pageUrl = `${url.origin}${url.pathname}`;
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/rest/v1/rpc/get_shared_posting`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ p_code: match[1], p_visitor_id: "crawler", p_device: null }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return ogHtml(GENERIC(pageUrl), url.origin);
    const data = (await res.json()) as {
      ok?: boolean;
      posting?: {
        title?: string;
        specs?: Record<string, unknown>;
        starting_price?: unknown;
        image_urls?: string[];
        location?: { district?: string | null; province?: string | null };
      };
    };
    const p = data.ok ? data.posting : null;
    if (!p?.title) return ogHtml(GENERIC(pageUrl), url.origin);

    const place = [p.location?.district, p.location?.province].filter(Boolean).join(", ");
    const price = shortMoney(p.starting_price);
    const description = [areaText(p.specs), price ? `Giá khởi điểm ${price}` : null, place || null, "Hồ sơ số hoá"]
      .filter(Boolean)
      .join(" · ");
    return ogHtml({ title: p.title, description, image: p.image_urls?.[0] ?? null, url: pageUrl }, url.origin);
  } catch {
    return ogHtml(GENERIC(pageUrl), url.origin);
  }
}
