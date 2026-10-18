import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AssetOwnerOrgKYC, AssetOwnerOrgKYCStatus } from "@/types/asset-owner";
import type { TablesInsert } from "@/integrations/supabase/types";
import { mapOrgKycError } from "@/lib/assetOwnerKyc/orgKycValidation";

type OrgKycWrite = TablesInsert<"asset_owner_org_kyc">;

/** id hồ sơ cụ thể · "new" = hồ sơ tổ chức mới · undefined = tự chọn. */
export type OrgKycSelection = string | "new" | undefined;

const UNFINISHED: AssetOwnerOrgKYCStatus[] = ["draft", "pending_review", "under_review", "rejected"];

const listKey = (userId: string | null) => ["asset_owner_org_kyc", userId];

/**
 * Hồ sơ đang thao tác. Không chỉ định ⇒ hồ sơ còn dở mới nhất, rồi tới hồ sơ đã
 * duyệt mới nhất (một tài khoản KYC được nhiều tổ chức — danh sách xếp mới trước).
 */
export function pickOrgKyc(list: AssetOwnerOrgKYC[], selection: OrgKycSelection): AssetOwnerOrgKYC | null {
  if (selection === "new") return null;
  if (selection) return list.find((k) => k.id === selection) ?? null;
  return list.find((k) => UNFINISHED.includes(k.status)) ?? list[0] ?? null;
}

/** Mọi hồ sơ KYC tổ chức của tài khoản, mới nhất trước. */
export function useAssetOwnerOrgKYCs(userId: string | null) {
  return useQuery<AssetOwnerOrgKYC[]>({
    queryKey: listKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_org_kyc")
        .select("*")
        .eq("created_by", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssetOwnerOrgKYC[];
    },
  });
}

interface Options {
  /** Gọi khi vừa tạo bản nháp mới (selection "new") — trang ghim id vào URL để lần lưu sau sửa đúng bản này. */
  onCreated?: (id: string) => void;
}

export function useAssetOwnerOrgKYC(userId: string | null, selection?: OrgKycSelection, { onCreated }: Options = {}) {
  const queryClient = useQueryClient();
  const qk = listKey(userId);
  const { data: orgKycs = [], isLoading } = useAssetOwnerOrgKYCs(userId);
  const orgKyc = pickOrgKyc(orgKycs, selection);

  // Bản nháp mới vào cache ngay ⇒ selection trỏ id mới không bị coi là "không tìm thấy"
  // trong lúc chờ tải lại danh sách.
  const insertDraft = async (fields: OrgKycWrite): Promise<string> => {
    const { data, error } = await supabase
      .from("asset_owner_org_kyc")
      .insert({ ...fields, status: "draft" })
      .select("*")
      .single();
    if (error) throw error;
    const row = data as unknown as AssetOwnerOrgKYC;
    queryClient.setQueryData<AssetOwnerOrgKYC[]>(qk, (prev = []) => [row, ...prev]);
    onCreated?.(row.id);
    return row.id;
  };

  const saveDraft = useMutation({
    mutationFn: async (fields: Partial<AssetOwnerOrgKYC>): Promise<string> => {
      // registry_match_data ở tầng app là Record<string, unknown>, ở DB là cột
      // JSONB (`Json`). Ép qua unknown đúng một lần tại ranh giới ghi thay vì
      // để cả payload thành `any`.
      const payload = { created_by: userId!, ...fields } as unknown as OrgKycWrite;
      if (!orgKyc?.id) return insertDraft(payload);
      const { error } = await supabase
        .from("asset_owner_org_kyc")
        .update(payload)
        .eq("id", orgKyc.id)
        .select("id")
        .single();
      if (error) throw error;
      return orgKyc.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
    onError: (err) => toast.error(mapOrgKycError(err, "Lỗi lưu nháp")),
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
    // Trigger asset_owner_org_kyc_branch_guard trả mã lỗi nghiệp vụ cho hồ sơ chi nhánh.
    onError: (err) => toast.error(mapOrgKycError(err, "Gửi hồ sơ thất bại")),
  });

  const uploadDoc = async (
    file: File,
    slot: "rep_id_front" | "rep_id_back" | "rep_selfie" | "establishment_doc" | "authorization_doc"
  ): Promise<string | null> => {
    if (!userId) return null;
    // Chưa có hồ sơ (hồ sơ tổ chức mới) ⇒ tạo bản nháp để có id làm đường dẫn tệp.
    let recordId = orgKyc?.id;
    if (!recordId) {
      try {
        recordId = await insertDraft({ created_by: userId });
      } catch {
        toast.error("Không thể tạo hồ sơ nháp");
        return null;
      }
    }
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

  return { orgKyc, orgKycs, isLoading, saveDraft, submit, uploadDoc };
}
