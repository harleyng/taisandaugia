import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toAuctionListing } from "@/types/listing";

export const PROPERTY_TYPES_QUERY_KEY = ["property-types-map"];

/** Bảng property_types là dữ liệu tham chiếu tĩnh, nhỏ — cache chung cho cả app. */
async function fetchPropertyTypesMap(): Promise<Record<string, { name: string; slug: string }>> {
  const { data } = await supabase.from("property_types").select("name, slug");
  const map: Record<string, { name: string; slug: string }> = {};
  for (const pt of data ?? []) map[pt.slug] = { name: pt.name, slug: pt.slug };
  return map;
}

export function useListingById(id: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      if (!id) throw new Error("ID không hợp lệ");

      // Trước đây: fetch listing rồi MỚI fetch property_types theo slug (tuần tự, mỗi
      // lượt xem 2 query). Nay chạy song song; map property_types cache 30 phút nên
      // các lượt xem sau chỉ còn 1 query (listing).
      const [listingRes, typeMap] = await Promise.all([
        supabase.from("listings").select("*").eq("id", id).single(),
        queryClient.ensureQueryData({
          queryKey: PROPERTY_TYPES_QUERY_KEY,
          queryFn: fetchPropertyTypesMap,
          staleTime: 30 * 60_000,
        }),
      ]);

      const { data, error } = listingRes;
      if (error) throw error;
      if (!data) throw new Error("Không tìm thấy tài sản");

      const pt = typeMap[data.property_type_slug];
      // toAuctionListing ép address/custom_attributes từ `Json` về kiểu thật một
      // lần duy nhất tại đây, thay vì để từng component tự `as any`.
      return {
        ...toAuctionListing(data),
        property_types: pt || { name: "BĐS", slug: data.property_type_slug },
      };
    },
    enabled: !!id,
    staleTime: 60_000,
    retry: false,
  });
}
