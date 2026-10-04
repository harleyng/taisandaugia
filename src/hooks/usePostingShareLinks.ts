import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { sharedPostingUrl } from "@/lib/postingShare/message";
import { assertShareRpcOk, shareErrorMessage } from "@/lib/postingShare/status";
import {
  mapShareLink,
  mapShareLinks,
  mapShareSenders,
  type PostingShareLink,
  type PostingShareLinks,
  type ShareLinkInput,
  type ShareSender,
  type ShareTarget,
} from "@/lib/postingShare/types";

// Link Hồ sơ online ở cổng chủ tài sản (migration 20261001100000, hợp nhất 20261004210000).
// Mã link KHÔNG đọc được qua bảng (quyền SELECT theo cột) — chỉ qua RPC, và chỉ người quản lý
// được link (so-hoa:share / truyen-thong:create trong phạm vi chi nhánh) nhận được mã.

/** Sao chép văn bản; false khi trình duyệt chặn (người dùng còn nút sao chép trong menu). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Mọi link của MỘT hồ sơ (tab "Hồ sơ online" của trang hồ sơ). */
export function usePostingShareLinks(postingId: string | null | undefined) {
  return useQuery({
    queryKey: qk.postingShare.links(postingId),
    enabled: !!postingId,
    queryFn: async (): Promise<PostingShareLinks> => {
      const { data, error } = await supabase.rpc("owner_posting_share_links", { p_posting_id: postingId! });
      if (error) throw error;
      assertShareRpcOk(data);
      return mapShareLinks(data);
    },
  });
}

const senderKey = (t: ShareTarget | null) => (t ? (t.kind === "posting" ? t.postingId : `ws:${t.workspaceId}`) : null);

/** Thành viên chọn được làm người gửi — kèm SĐT trong hồ sơ của họ (null = chưa có). */
export function useShareSenders(target: ShareTarget | null, enabled = true) {
  return useQuery({
    queryKey: qk.postingShare.senders(senderKey(target)),
    enabled: !!target && enabled,
    queryFn: async (): Promise<ShareSender[]> => {
      const { data, error } = await supabase.rpc("share_link_senders", {
        p_workspace_id: target!.workspaceId as string,
        p_posting_id: (target!.kind === "posting" ? target!.postingId : null) as string,
      });
      if (error) throw error;
      assertShareRpcOk(data);
      return mapShareSenders(data);
    },
  });
}

/** Số liệu đổi ở cả danh sách theo hồ sơ lẫn trang tổng hợp / chi tiết. */
function useInvalidateShareLinks() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["posting-share", "links"] });
    void queryClient.invalidateQueries({ queryKey: qk.shareLinks.all });
  };
}

const rpcArgs = (input: ShareLinkInput) => ({
  p_label: input.label,
  p_channel: input.channel,
  // Bỏ trống = không có người gửi.
  p_sender_user_id: (input.senderUserId ?? null) as string,
  p_show_price: input.showPrice,
  p_show_exact_address: input.showExactAddress,
  p_show_sender_contact: input.showSenderContact,
  p_expires_in_days: input.expiresInDays as number,
});

/** Tạo link cho một hồ sơ hoặc tin — xong tự sao chép để cán bộ dán ngay vào Zalo / email. */
export function useCreateShareLink(target: ShareTarget | null) {
  const invalidate = useInvalidateShareLinks();
  return useMutation({
    mutationFn: async (input: ShareLinkInput): Promise<PostingShareLink> => {
      if (!target) throw new Error("no_target");
      const { data, error } = await supabase.rpc("create_share_link", {
        p_workspace_id: target.workspaceId as string,
        p_posting_id: (target.kind === "posting" ? target.postingId : null) as string,
        p_listing_id: (target.kind === "listing" ? target.listingId : null) as string,
        ...rpcArgs(input),
      });
      if (error) throw error;
      assertShareRpcOk(data);
      return mapShareLink((data as { link?: unknown }).link);
    },
    onSuccess: async (link) => {
      const copied = link.code ? await copyText(sharedPostingUrl(link.code)) : false;
      toast.success(copied ? "Đã tạo link và sao chép — dán vào Zalo hoặc email gửi khách" : "Đã tạo link chia sẻ");
    },
    onError: (err) => toast.error(shareErrorMessage(err, "Không tạo được link. Vui lòng thử lại.")),
    onSettled: invalidate,
  });
}

/** Sửa link — `changeExpiry = false` giữ nguyên hạn hiện tại. Mã link không đổi. */
export function useUpdateShareLink() {
  const invalidate = useInvalidateShareLinks();
  return useMutation({
    mutationFn: async ({ linkId, input, changeExpiry }: { linkId: string; input: ShareLinkInput; changeExpiry: boolean }) => {
      const { data, error } = await supabase.rpc("update_share_link", {
        p_link_id: linkId,
        p_change_expiry: changeExpiry,
        ...rpcArgs(input),
      });
      if (error) throw error;
      assertShareRpcOk(data);
    },
    onSuccess: () => toast.success("Đã lưu — link đã gửi vẫn mở được với nội dung mới"),
    onError: (err) => toast.error(shareErrorMessage(err)),
    onSettled: invalidate,
  });
}

/** Thu hồi — người có link sẽ thấy "không còn hiệu lực"; số liệu cũ vẫn giữ. */
export function useRevokeShareLink() {
  const invalidate = useInvalidateShareLinks();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { data, error } = await supabase.rpc("revoke_share_link", { p_link_id: linkId });
      if (error) throw error;
      assertShareRpcOk(data);
    },
    onSuccess: () => toast.success("Đã thu hồi link — người có link sẽ không mở được nữa"),
    onError: (err) => toast.error(shareErrorMessage(err, "Không thu hồi được link. Vui lòng thử lại.")),
    onSettled: invalidate,
  });
}
