import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AssetOwnerKYC } from "@/types/asset-owner";

export function useAssetOwnerKYC(userId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["asset_owner_kyc", userId];

  const { data: kyc, isLoading } = useQuery<AssetOwnerKYC | null>({
    queryKey: qk,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_kyc")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as AssetOwnerKYC | null;
    },
  });

  const saveDraft = useMutation({
    mutationFn: async (fields: Partial<AssetOwnerKYC>) => {
      const { data, error } = await supabase
        .from("asset_owner_kyc")
        .upsert({ user_id: userId!, ...fields, status: "draft" }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
    onError: () => toast.error("Lỗi lưu nháp"),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_kyc")
        .update({ status: "pending_review", submitted_at: new Date().toISOString() })
        .eq("user_id", userId!)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Không tìm thấy hồ sơ để cập nhật");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Hồ sơ đã được gửi, chờ xét duyệt trong 1–2 ngày làm việc");
    },
    onError: () => toast.error("Gửi hồ sơ thất bại"),
  });

  const uploadEKYCFile = async (
    file: File,
    slot: "id_front" | "id_back" | "selfie"
  ): Promise<string | null> => {
    if (!userId) return null;
    const ext = file.name.split(".").pop();
    const path = `${userId}/${slot}.${ext}`;
    const { error } = await supabase.storage
      .from("kyc-ekyc")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Tải ảnh thất bại");
      return null;
    }
    return path;
  };

  return { kyc, isLoading, saveDraft, submit, uploadEKYCFile };
}
