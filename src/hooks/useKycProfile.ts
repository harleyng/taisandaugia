import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import type { SaveIdPhotoInput } from "@/lib/ekyc/kycProfileForm";
import { BUYER_KYC_BUCKET, discardKycFiles } from "@/lib/ekyc/uploadKycImage";
import type { VerifiedIdentity } from "@/types/bidding-contract";

/**
 * Danh tính đã lưu trên tài khoản (user_verified_identities) — VNeID hoặc ảnh
 * giấy tờ (20261008100000). Một người một dòng; lưu mới là ghi đè.
 *
 * Ảnh nằm ở bucket PRIVATE `buyer-kyc`, đường dẫn {user_id}/{uuid}.{ext}, không
 * bao giờ ghi đè. Policy chặn xoá ảnh còn được danh tính hoặc hồ sơ tham gia
 * nào dùng ⇒ dọn ảnh cũ luôn là "cố gắng", lỗi bỏ qua.
 */

export { BUYER_KYC_BUCKET };
/** URL ký sống 10 phút; cache 9 phút để không bao giờ đưa ra URL đã hết hạn. */
const SIGNED_URL_TTL_S = 600;

export function useKycProfile() {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.verifiedIdentity(userId),
    enabled: !!userId,
    queryFn: async (): Promise<VerifiedIdentity | null> => {
      const { data, error } = await supabase
        .from("user_verified_identities")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as VerifiedIdentity | null) ?? null;
    },
  });
}

export type { SaveIdPhotoInput };


/** Lưu danh tính từ ảnh giấy tờ vào hồ sơ người dùng (save_id_photo_identity). */
export function useSaveIdPhotoIdentity() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: SaveIdPhotoInput): Promise<VerifiedIdentity> => {
      if (!userId) throw new Error("Vui lòng đăng nhập.");
      const previous = queryClient.getQueryData<VerifiedIdentity | null>(qk.verifiedIdentity(userId));

      const { error } = await supabase.rpc("save_id_photo_identity", {
        _id_type: v.id_type,
        _id_number: v.id_number,
        _full_name: v.full_name,
        _date_of_birth: v.date_of_birth,
        _address: v.address,
        _id_front_path: v.id_front_path,
        _id_back_path: v.id_back_path ?? undefined,
        _gender: v.gender ?? undefined,
        _id_issued_on: v.id_issued_on ?? undefined,
        _read_method: v.read_method,
        _edited_fields: v.edited_fields,
      });
      if (error) throw error;

      const kept = new Set([v.id_front_path, v.id_back_path]);
      await discardKycFiles([previous?.id_front_path, previous?.id_back_path].filter((p) => !kept.has(p)));

      const { data, error: readError } = await supabase
        .from("user_verified_identities")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (readError) throw readError;
      return data as VerifiedIdentity;
    },
    onSuccess: (identity) => {
      queryClient.setQueryData(qk.verifiedIdentity(userId), identity);
      toast.success("Đã lưu danh tính vào hồ sơ của bạn.");
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

/** Xoá danh tính đã lưu. Hồ sơ đã nộp giữ nguyên bản chụp (và ảnh) của nó. */
export function useDeleteKycProfile() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const previous = queryClient.getQueryData<VerifiedIdentity | null>(qk.verifiedIdentity(userId));
      const { error } = await supabase.from("user_verified_identities").delete().eq("user_id", userId!);
      if (error) throw error;
      await discardKycFiles([previous?.id_front_path, previous?.id_back_path]);
    },
    onSuccess: () => {
      queryClient.setQueryData(qk.verifiedIdentity(userId), null);
      toast.success("Đã xoá danh tính đã lưu.");
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

/**
 * URL ký cho một ảnh trong buyer-kyc. Người mua đọc ảnh của mình; tổ chức đọc ảnh
 * hồ sơ đã thanh toán (can_read_buyer_kyc_object). Không có quyền ⇒ lỗi query.
 */
export function useKycImageUrl(path?: string | null) {
  return useQuery({
    queryKey: qk.kycImageUrl(path),
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_S - 60) * 1000,
    gcTime: SIGNED_URL_TTL_S * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from(BUYER_KYC_BUCKET)
        .createSignedUrl(path!, SIGNED_URL_TTL_S);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
