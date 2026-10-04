// Đối tác riêng của chủ tài sản (bảng owner_partners, mig 20261004100000) — kiểu + logic
// thuần của ô chọn đối tác. Không React, không supabase để test được.

import type { DossierKind } from "./types";

export interface OwnerPartner {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  kind: DossierKind;
  name: string;
  auction_org_id: string | null;
  created_at: string;
}

/** Một tổ chức trong danh bạ công khai auction_organizations. */
export interface DirectoryOrg {
  id: string;
  name: string;
  province: string | null;
}

/** Khoá phạm vi cho query key: id Trạm hoặc "personal". */
export const partnerScopeKey = (workspaceId: string | null) => workspaceId ?? "personal";

/** Chuẩn hoá để so tên (bỏ dấu, hoa thường, khoảng trắng) — cùng ý với partner_name_key ở SQL. */
export function nameKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export const matchesQuery = (name: string, query: string) => !query.trim() || nameKey(name).includes(nameKey(query));

export interface PartnerOptions {
  mine: OwnerPartner[];
  /** Chỉ phần Đấu giá: tổ chức trong danh bạ chưa nằm trong đối tác của tôi. */
  directory: DirectoryOrg[];
  /** Tên đang gõ chưa trùng đối tác nào của tôi ⇒ nút thêm mới gọi đúng tên đó. */
  canAddTyped: boolean;
}

/** Lọc + ghép các lựa chọn của ô chọn đối tác theo loại và chuỗi đang gõ. */
export function partnerOptions(
  partners: readonly OwnerPartner[],
  kind: DossierKind,
  query: string,
  directory: readonly DirectoryOrg[] = [],
  directoryLimit = 50,
): PartnerOptions {
  const ofKind = partners.filter((p) => p.kind === kind);
  const mine = ofKind.filter((p) => matchesQuery(p.name, query)).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const linked = new Set(ofKind.map((p) => p.auction_org_id).filter(Boolean));
  const dir =
    kind === "auction"
      ? directory.filter((o) => !linked.has(o.id) && matchesQuery(o.name, query)).slice(0, directoryLimit)
      : [];
  const typed = nameKey(query);
  return { mine, directory: dir, canAddTyped: !!typed && !ofKind.some((p) => nameKey(p.name) === typed) };
}
