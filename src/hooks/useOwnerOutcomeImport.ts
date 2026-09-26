import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  mergeImportResults,
  type ImportIssue,
  type ImportRowResult,
  type ValidImportRow,
} from "@/lib/ownerOutcomeImport";
import { invalidateOwnerOutcomes } from "@/hooks/useOwnerOutcomeEdit";

export interface ImportOutcomesResult {
  written: number;
  failures: ImportIssue[];
}

/**
 * Ghi các dòng HỢP LỆ qua RPC owner_import_outcomes (SECURITY INVOKER — RLS và
 * trigger guard áp như khai tay). Server báo lỗi theo từng dòng; dòng lỗi không
 * kéo các dòng khác đổ theo.
 */
export function useImportOwnerOutcomes(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (valid: ValidImportRow[]): Promise<ImportOutcomesResult> => {
      if (!workspaceId) throw new Error("no_workspace");
      const { data, error } = await supabase.rpc("owner_import_outcomes", {
        p_workspace_id: workspaceId,
        p_rows: valid.map((v) => v.payload) as unknown as Json,
      });
      if (error) throw error;
      return mergeImportResults(valid, (Array.isArray(data) ? data : []) as unknown as ImportRowResult[]);
    },
    onSuccess: ({ written, failures }) => {
      if (written && !failures.length) toast.success(`Đã ghi ${written} kết quả phiên`);
      else if (written) toast.warning(`Đã ghi ${written} dòng · ${failures.length} dòng chưa ghi được`);
      else toast.error("Chưa ghi được dòng nào — xem lý do từng dòng.");
    },
    onError: (err) =>
      toast.error(
        (err as { code?: string })?.code === "42501"
          ? "Bạn không có quyền nhập kết quả cho đơn vị này."
          : "Không nhập được file. Vui lòng thử lại.",
      ),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}
