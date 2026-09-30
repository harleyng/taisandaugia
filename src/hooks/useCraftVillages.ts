import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import {
  craftMapErrorMessage,
  parseCraftMapState,
  type CraftMapState,
  type PublicCraftVillage,
} from "@/lib/craftVillages";

/** Trang /lang-nghe + teaser trang chủ: hồ sơ làng nghề đã công khai và đã được duyệt. */
export function usePublicCraftVillages() {
  return useQuery<PublicCraftVillage[]>({
    queryKey: qk.craftVillages.public,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_craft_villages");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

/** Thẻ "Công khai lên bản đồ làng nghề" ở chi tiết hồ sơ số hoá. */
export function useCraftMapState(postingId: string | null | undefined) {
  return useQuery<CraftMapState>({
    queryKey: qk.craftVillages.mapState(postingId),
    enabled: !!postingId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_craft_map_state", { _posting_id: postingId! });
      if (error) throw error;
      return parseCraftMapState(data);
    },
  });
}

export interface SetCraftMapInput {
  postingId: string;
  published: boolean;
  latitude: number;
  longitude: number;
  product: string;
}

export function useSetCraftMapPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postingId, published, latitude, longitude, product }: SetCraftMapInput) => {
      const { data, error } = await supabase.rpc("owner_set_craft_map_publication", {
        _posting_id: postingId,
        _published: published,
        _latitude: latitude,
        _longitude: longitude,
        _product: product,
      });
      if (error) throw error;
      const res = data as { ok?: boolean; reason?: string } | null;
      if (!res?.ok) throw new Error(craftMapErrorMessage(res?.reason));
      return published;
    },
    onSuccess: (published) => {
      qc.invalidateQueries({ queryKey: qk.craftVillages.all });
      toast.success(published ? "Đã công khai lên bản đồ làng nghề" : "Đã lưu — hồ sơ không hiện trên bản đồ");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Không lưu được, vui lòng thử lại"),
  });
}
