// Khoá chung khi trộn tin trên sàn và hồ sơ số hoá trong một danh sách chọn (tạo link, chiến
// dịch). Thuần — test ở assets.test.ts.

import type { ShareTargetKind } from "@/lib/postingShare/types";

export const assetKey = (kind: ShareTargetKind, id: string) => `${kind}:${id}`;

/** Tách khoá "kind:id" thành hai danh sách id cho RPC (giữ thứ tự chọn). */
export function splitAssetKeys(keys: readonly string[]): { listingIds: string[]; postingIds: string[] } {
  const listingIds: string[] = [];
  const postingIds: string[] = [];
  for (const k of keys) {
    const [kind, id] = k.split(":");
    if (!id) continue;
    if (kind === "listing") listingIds.push(id);
    else if (kind === "posting") postingIds.push(id);
  }
  return { listingIds, postingIds };
}
