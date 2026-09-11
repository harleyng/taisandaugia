import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { qk } from "@/lib/queryKeys";
import { contractErrorMessage } from "@/lib/biddingContracts/errors";
import { mockVneidIdentity } from "@/lib/vneid/mockVneid";
import type { VerifiedIdentity } from "@/types/bidding-contract";

/** Danh tính đã xác thực qua VNeID của người đang đăng nhập (null = chưa liên kết). */
export function useVerifiedIdentity() {
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

/** Đủ lâu để thấy "đang chờ ứng dụng", chưa đủ để sốt ruột. */
const MOCK_APPROVAL_MS = 1600;

/**
 * Liên kết VNeID: lấy thông tin định danh rồi lưu vào user_verified_identities.
 *
 * ĐÂY LÀ SEAM ĐỔI SANG VNeID THẬT. Hôm nay mutationFn giả độ trễ, sinh công dân
 * bịa bằng mockVneidIdentity rồi tự gọi save_vneid_identity (MÔ PHỎNG — tin
 * client). Bản thật: mở luồng OAuth VNeID, Edge Function nhận callback, xác minh
 * chữ ký và TỰ ghi dòng bằng service_role; ở đây chỉ còn chờ callback rồi đọc lại
 * dòng. Miễn trả về VerifiedIdentity thì VneidConsentDialog và form mua hồ sơ
 * không phải sửa.
 */
export function useVneidLink() {
  const { userId } = useAuth();
  const { data: profile } = useProfile(userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<VerifiedIdentity> => {
      if (!userId) throw new Error("Vui lòng đăng nhập.");
      await new Promise((resolve) => window.setTimeout(resolve, MOCK_APPROVAL_MS));

      const citizen = mockVneidIdentity(userId, profile?.name);
      const { error } = await supabase.rpc("save_vneid_identity", {
        _full_name: citizen.full_name,
        _id_number: citizen.id_number,
        _date_of_birth: citizen.date_of_birth,
        _address: citizen.address,
        _gender: citizen.gender,
        _id_issued_on: citizen.id_issued_on,
      });
      if (error) throw error;

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
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}

/** Huỷ liên kết = xoá dòng. Hồ sơ đã mua giữ nguyên bản chụp danh tính của nó. */
export function useUnlinkVneid() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_verified_identities").delete().eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData(qk.verifiedIdentity(userId), null);
      toast.success("Đã huỷ liên kết VNeID.");
    },
    onError: (err) => toast.error(contractErrorMessage(err)),
  });
}
