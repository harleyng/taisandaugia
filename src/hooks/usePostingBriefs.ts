// Brief hồ sơ (mã HS / loại / nơi / ảnh) cho trang chi tiết hợp đồng — kernel dùng
// chung với sàn đấu giá trực tuyến (docs/platform-ownership.md §7). Tách khỏi
// hooks/useOwnerContracts để trang hợp đồng mua bán phía bên bán chép sang repo
// kia mà không kéo theo menu Hợp đồng của cổng chủ tài sản.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import {
  POSTING_BRIEF_SELECT,
  toPostingBrief,
  type PostingBrief,
  type PostingBriefRow,
} from "@/lib/contracts/postingBrief";

/** Mã HS / loại / nơi / ảnh của nhiều hồ sơ một lượt. RLS chỉ trả hồ sơ người xem đọc được. */
export function usePostingBriefs(postingIds: readonly string[]): Map<string, PostingBrief> {
  const { data } = useQuery({
    queryKey: qk.ownerPostingBriefs(postingIds),
    enabled: postingIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PostingBrief[]> => {
      const { data, error } = await supabase.from("asset_postings").select(POSTING_BRIEF_SELECT).in("id", [...postingIds]);
      if (error) throw error;
      return ((data ?? []) as PostingBriefRow[]).map(toPostingBrief);
    },
  });
  return useMemo(() => new Map((data ?? []).map((b) => [b.id, b])), [data]);
}

/** Một hồ sơ (trang chi tiết hợp đồng). */
export function usePostingBrief(postingId: string | null | undefined): PostingBrief | null {
  const map = usePostingBriefs(postingId ? [postingId] : []);
  return postingId ? (map.get(postingId) ?? null) : null;
}
