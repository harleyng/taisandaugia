// Trang tổng hợp link Hồ sơ online của Trạm (menu Truyền thông → "Link theo dõi"). Thuần —
// test ở filters.test.ts. Server đã lọc theo phạm vi chi nhánh; còn lại lọc ở client.

import { shareLinkState, type ShareLinkState } from "@/lib/postingShare/status";
import type { PostingShareLink } from "@/lib/postingShare/types";

export const FILTER_ALL = "tat-ca";

export const SOURCE_FILTERS = [
  { value: FILTER_ALL, label: "Tất cả" },
  { value: "chien-dich", label: "Từ chiến dịch" },
  { value: "rieng-le", label: "Tạo riêng" },
] as const;

export const KIND_FILTERS = [
  { value: FILTER_ALL, label: "Tất cả" },
  { value: "ho-so", label: "Hồ sơ số hoá" },
  { value: "tin", label: "Tin trên sàn" },
] as const;

export const STATE_FILTERS = [
  { value: FILTER_ALL, label: "Tất cả" },
  { value: "dang-mo", label: "Đang mở" },
  { value: "het-han", label: "Hết hạn" },
  { value: "thu-hoi", label: "Đã thu hồi" },
] as const;

const STATE_OF: Record<string, ShareLinkState> = { "dang-mo": "active", "het-han": "expired", "thu-hoi": "revoked" };

export interface ShareLinkFilters {
  q: string;
  channel: string;
  source: string;
  kind: string;
  state: string;
  branch: string;
  /** id hồ sơ / tin (?tai-san=) — mở từ trang Tài sản. */
  asset: string;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export function filterShareLinks(
  rows: readonly PostingShareLink[],
  f: ShareLinkFilters,
  now: Date = new Date(),
): PostingShareLink[] {
  const needle = fold(f.q.trim());
  return rows.filter((r) => {
    if (f.channel !== FILTER_ALL && r.channel !== f.channel) return false;
    if (f.source === "chien-dich" && !r.campaignId) return false;
    if (f.source === "rieng-le" && r.campaignId) return false;
    if (f.kind === "ho-so" && r.targetKind !== "posting") return false;
    if (f.kind === "tin" && r.targetKind !== "listing") return false;
    if (f.state !== FILTER_ALL && shareLinkState(r, now) !== STATE_OF[f.state]) return false;
    if (f.branch !== FILTER_ALL && r.branchId !== f.branch) return false;
    if (f.asset && r.postingId !== f.asset && r.listingId !== f.asset) return false;
    if (!needle) return true;
    return [r.label, r.targetTitle, r.targetCode ?? "", r.campaignName ?? "", r.branchName ?? ""].some((s) =>
      fold(s).includes(needle),
    );
  });
}

export interface ShareLinksSummary {
  links: number;
  active: number;
  views: number;
  viewers: number;
  dossier: number;
  follow: number;
}

/** Ô tổng ở đầu trang — bộ đếm trọn đời của các link đang hiện. */
export function summarizeShareLinks(rows: readonly PostingShareLink[], now: Date = new Date()): ShareLinksSummary {
  return rows.reduce<ShareLinksSummary>(
    (s, r) => ({
      links: s.links + 1,
      active: s.active + (shareLinkState(r, now) === "active" ? 1 : 0),
      views: s.views + r.viewCount,
      viewers: s.viewers + r.uniqueViewCount,
      dossier: s.dossier + r.ctaDossierCount,
      follow: s.follow + r.ctaFollowCount,
    }),
    { links: 0, active: 0, views: 0, viewers: 0, dossier: 0, follow: 0 },
  );
}

/** Chi nhánh có link — cho ô lọc (chỉ hiện khi Trạm có ≥ 2 chi nhánh). */
export function branchOptions(rows: readonly PostingShareLink[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const r of rows) if (r.branchId && !seen.has(r.branchId)) seen.set(r.branchId, r.branchName ?? "Chi nhánh");
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
