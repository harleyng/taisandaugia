import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { qk } from "@/lib/queryKeys";
import {
  mergePostingImportResults,
  type CreatedPosting,
  type PostingImportIssue,
  type PostingImportRowResult,
  type ValidPostingRow,
} from "@/lib/asset-posting/postingImport";

export interface ImportPostingsResult {
  created: CreatedPosting[];
  failures: PostingImportIssue[];
}

/**
 * Ghi các dòng HỢP LỆ thành hồ sơ NHÁP qua RPC owner_import_postings (SECURITY
 * INVOKER — RLS so-hoa:create + phạm vi chi nhánh áp như lưu nháp từ wizard).
 * Tenant = tenant đang chọn; Cá nhân ⇒ workspace NULL. Lỗi dòng nào báo dòng đó.
 */
export function useImportOwnerPostings() {
  const { userId } = useAuth();
  const { workspaceId } = useOwnerWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (valid: ValidPostingRow[]): Promise<ImportPostingsResult> => {
      const { data, error } = await supabase.rpc("owner_import_postings", {
        // Kiểu sinh ra không cho null, nhưng hàm nhận NULL = tenant Cá nhân.
        p_workspace_id: workspaceId as string,
        p_rows: valid.map((v) => v.payload) as unknown as Json,
      });
      if (error) throw error;
      return mergePostingImportResults(valid, (Array.isArray(data) ? data : []) as unknown as PostingImportRowResult[]);
    },
    onSuccess: ({ created, failures }) => {
      if (created.length && !failures.length) toast.success(`Đã tạo ${created.length} hồ sơ nháp`);
      else if (created.length) toast.warning(`Đã tạo ${created.length} hồ sơ · ${failures.length} dòng chưa nhập được`);
      else toast.error("Chưa nhập được dòng nào — xem lý do từng dòng.");
    },
    onError: (err) =>
      toast.error(
        (err as { code?: string })?.code === "42501"
          ? "Bạn không có quyền tạo hồ sơ trong không gian này."
          : "Không nhập được file. Vui lòng thử lại.",
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.myPostings(userId) }),
  });
}
