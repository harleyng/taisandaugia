import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import {
  craftMapErrorMessage,
  parseCraftMapState,
  parseCraftVillageState,
  parsePublicVillage,
  type CraftMapState,
  type CraftVillageState,
  type PublicCraftVillage,
} from "@/lib/craftVillages";

/** Trang /lang-nghe + teaser trang chủ: các làng đã công khai, mỗi làng kèm hồ sơ đang hiện. */
export function usePublicCraftVillages() {
  return useQuery<PublicCraftVillage[]>({
    queryKey: qk.craftVillages.public,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_craft_villages");
      if (error) throw error;
      return (data ?? []).map(parsePublicVillage);
    },
    staleTime: 5 * 60_000,
  });
}

/** Thẻ "Hiện trong trang làng nghề" ở chi tiết hồ sơ số hoá. */
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

function assertOk(data: unknown) {
  const res = data as { ok?: boolean; reason?: string } | null;
  if (!res?.ok) throw new Error(craftMapErrorMessage(res?.reason));
}

/** Bật/tắt một hồ sơ trong trang làng (hồ sơ phải đã duyệt). */
export function useSetCraftAssetVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postingId, published }: { postingId: string; published: boolean }) => {
      const { data, error } = await supabase.rpc("owner_set_craft_asset_visibility", {
        _posting_id: postingId,
        _published: published,
      });
      if (error) throw error;
      assertOk(data);
      return published;
    },
    onSuccess: (published) => {
      qc.invalidateQueries({ queryKey: qk.craftVillages.all });
      toast.success(published ? "Hồ sơ đã hiện trong trang làng nghề" : "Đã ẩn hồ sơ khỏi trang làng nghề");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Không lưu được, vui lòng thử lại"),
  });
}

/** Trang "Hồ sơ làng nghề" của Trạm; Trạm không phải làng nghề ⇒ eligible false. */
export function useCraftVillageProfile(workspaceId: string | null | undefined) {
  return useQuery<CraftVillageState>({
    queryKey: qk.craftVillages.profile(workspaceId),
    enabled: !!workspaceId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_craft_village_profile", { _workspace_id: workspaceId! });
      if (error) throw error;
      return parseCraftVillageState(data);
    },
  });
}

export interface SaveCraftVillageInput {
  workspaceId: string;
  published: boolean;
  latitude: number;
  longitude: number;
  province: string | null;
  product: string;
  intro: string | null;
  coverPostingId: string | null;
}

export function useSaveCraftVillageProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: SaveCraftVillageInput) => {
      const { data, error } = await supabase.rpc("owner_set_craft_village_profile", {
        _workspace_id: v.workspaceId,
        _published: v.published,
        _latitude: v.latitude,
        _longitude: v.longitude,
        _province: v.province,
        _product: v.product,
        _intro: v.intro,
        _cover_posting_id: v.coverPostingId,
      });
      if (error) throw error;
      assertOk(data);
      return v.published;
    },
    onSuccess: (published) => {
      qc.invalidateQueries({ queryKey: qk.craftVillages.all });
      toast.success(published ? "Đã lưu và công khai làng lên bản đồ" : "Đã lưu — làng chưa hiện trên bản đồ");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Không lưu được, vui lòng thử lại"),
  });
}
