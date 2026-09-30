/**
 * Trang chặn nhúng iframe (X-Frame-Options: SAMEORIGIN / frame-ancestors) ⇒ khung nhúng chỉ
 * hiện "từ chối kết nối". Với các host này VrTourViewer hiện thẻ "Mở VR tour" mở tab mới.
 * claude.ai: link artifact — kiểm bằng header ngày 30/09/2026.
 */
const LINK_ONLY_HOSTS = ["claude.ai"];

/**
 * Tour tự host trong `public/vr/` (vd. https://taisandaugia.vn/vr/bat-trang.html). DB bắt
 * link tuyệt đối https ⇒ lưu theo tên miền production, còn lúc hiển thị nạp theo origin
 * hiện tại để chạy được cả localhost lẫn bản preview.
 */
const OWN_HOSTS = ["taisandaugia.vn", "www.taisandaugia.vn"];

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export function vrOpensInNewTab(url: string): boolean {
  const host = hostOf(url);
  return !!host && LINK_ONLY_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** URL nạp vào iframe: link trên tên miền của sàn ⇒ đổi sang origin đang chạy. */
export function vrEmbedSrc(url: string, origin: string): string {
  const host = hostOf(url);
  if (!host || !OWN_HOSTS.includes(host)) return url;
  const u = new URL(url);
  return `${origin}${u.pathname}${u.search}${u.hash}`;
}
