import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AssetOwnerOrgKYC } from "@/types/asset-owner";
import type { TablesInsert } from "@/integrations/supabase/types";

type OrgKycWrite = TablesInsert<"asset_owner_org_kyc">;

export function useAssetOwnerOrgKYC(userId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["asset_owner_org_kyc", userId];

  const { data: orgKyc, isLoading } = useQuery<AssetOwnerOrgKYC | null>({
    queryKey: qk,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_org_kyc")
        .select("*")
        .eq("created_by", userId!)
        // If duplicates exist, prefer highest-priority status then latest
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AssetOwnerOrgKYC | null;
    },
  });

  const saveDraft = useMutation({
    mutationFn: async (fields: Partial<AssetOwnerOrgKYC>): Promise<string> => {
      // registry_match_data ở tầng app là Record<string, unknown>, ở DB là cột
      // JSONB (`Json`). Ép qua unknown đúng một lần tại ranh giới ghi thay vì
      // để cả payload thành `any`.
      const payload = { created_by: userId!, ...fields } as unknown as OrgKycWrite;
      if (orgKyc?.id) {
        // Update existing record
        const { error } = await supabase
          .from("asset_owner_org_kyc")
          .update(payload)
          .eq("id", orgKyc.id)
          .select("id")
          .single();
        if (error) throw error;
        return orgKyc.id;
      } else {
        // Upsert on created_by to prevent duplicate records
        const { data, error } = await supabase
          .from("asset_owner_org_kyc")
          .upsert({ ...payload, status: "draft" }, { onConflict: "created_by" })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
    onError: () => toast.error("Lỗi lưu nháp"),
  });

  const submit = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("asset_owner_org_kyc")
        .update({ status: "pending_review", submitted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, status")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Không tìm thấy hồ sơ để cập nhật");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Hồ sơ tổ chức đã được gửi, SLA 1–2 ngày làm việc");
    },
    onError: () => toast.error("Gửi hồ sơ thất bại"),
  });

  const uploadDoc = async (
    file: File,
    slot: "rep_id_front" | "rep_id_back" | "rep_selfie" | "establishment_doc" | "authorization_doc"
  ): Promise<string | null> => {
    if (!userId) return null;
    // Reuse existing record or upsert a draft
    let recordId = orgKyc?.id;
    if (!recordId) {
      const { data: created } = await supabase
        .from("asset_owner_org_kyc")
        .upsert({ created_by: userId, status: "draft" }, { onConflict: "created_by" })
        .select("id")
        .single();
      recordId = created?.id;
    }
    if (!recordId) { toast.error("Không thể tạo hồ sơ nháp"); return null; }
    const ext = file.name.split(".").pop();
    const path = `${userId}/org_${recordId}/${slot}.${ext}`;
    const { error } = await supabase.storage
      .from("kyc-ekyc")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Tải tài liệu thất bại");
      return null;
    }
    return path;
  };

  return { orgKyc, isLoading, saveDraft, submit, uploadDoc };
}
