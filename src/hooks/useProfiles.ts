import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export interface ProfileBrief {
  id: string;
  name: string | null;
  email: string;
}

/** Tìm tài khoản trên sàn theo tên/email. Dùng CHUNG queryKey với
 *  AddRecipientsDialog để hai nơi chia sẻ cache — đổi key ở một chỗ thì mất.
 *  Đọc được nhờ policy "Admins can view all profiles". */
export function useProfileSearch(term: string, enabled = true) {
  // Ký tự đặc biệt của PostgREST .or() phải bỏ đi, nếu không filter vỡ cú pháp.
  const q = term.trim().replace(/[,()%*]/g, " ").trim();
  return useQuery<ProfileBrief[]>({
    queryKey: qk.profileSearch(q),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,email")
        .or(`email.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ProfileBrief[];
    },
    enabled: enabled && q.length >= 2,
  });
}

/** Thông tin gọn của một tài khoản.
 *
 *  LƯU Ý: customers.user_id trỏ auth.users chứ không phải public.profiles, nên
 *  PostgREST KHÔNG embed được profiles từ customers ("Could not find a
 *  relationship"). Bắt buộc phải truy vấn rời như thế này. */
export function useProfileBrief(userId?: string | null) {
  return useQuery<ProfileBrief | null>({
    queryKey: ["profile-brief", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,email")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProfileBrief | null;
    },
    enabled: !!userId,
  });
}
