import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import { draftToRows, type DossierDraft, type DossierRowLike } from "@/lib/dossier/draft";
import type { DossierKind } from "@/lib/dossier/types";

// Phần dịch vụ của hồ sơ số hoá — đọc/ghi asset_posting_dossier_items. RLS theo hồ sơ cha: ai đọc hồ sơ thì đọc phần dịch vụ, ghi cần
// quyền sửa hồ sơ số hoá (owner_posting_can 'so-hoa' 'update').

export type DossierItemRow = DossierRowLike & {
  id: string;
  posting_id: string;
  workspace_id: string | null;
  service_request_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Các phần dịch vụ đã lưu của một hồ sơ (≤ 3 dòng). */
export function useDossierItems(postingId: string | null | undefined) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.postingDossier.items(postingId),
    enabled: !!postingId && !!userId,
    queryFn: async (): Promise<DossierItemRow[]> => {
      const { data, error } = await supabase
        .from("asset_posting_dossier_items")
        .select("*")
        .eq("posting_id", postingId as string);
      if (error) throw error;
      return (data ?? []) as DossierItemRow[];
    },
  });
}

export interface SyncDossierArgs {
  postingId: string;
  draft: DossierDraft;
  /** Chỉ ghi các phần này (hộp thoại sửa MỘT phần). Bỏ trống = cả 3. */
  kinds?: DossierKind[];
  /** Tự lưu nháp ngầm — không toast. */
  silent?: boolean;
}

/**
 * Ghi các phần dịch vụ theo giá trị form: upsert phần đã chọn nguồn, xoá phần để trống,
 * BỎ QUA phần "Đã có đối tác" còn thiếu trường bắt buộc (trả về trong `incomplete`).
 * Không xoá tệp trong storage — tệp bị bỏ khỏi danh sách chỉ không còn được tham chiếu.
 */
export function useSyncDossierItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postingId, draft, kinds }: SyncDossierArgs) => {
      const plan = draftToRows(draft, postingId);
      const keep = (k: string) => !kinds || kinds.includes(k as DossierKind);
      const upserts = plan.upserts.filter((r) => keep(r.kind));
      const deletes = plan.deletes.filter(keep);
      if (upserts.length) {
        const { error } = await supabase
          .from("asset_posting_dossier_items")
          .upsert(upserts, { onConflict: "posting_id,kind" });
        if (error) throw error;
      }
      if (deletes.length) {
        const { error } = await supabase
          .from("asset_posting_dossier_items")
          .delete()
          .eq("posting_id", postingId)
          .in("kind", deletes);
        if (error) throw error;
      }
      return { incomplete: plan.incomplete.filter(keep) };
    },
    onSuccess: (_d, vars) => {
      if (!vars.silent) toast.success("Đã lưu thông tin đối tác.");
    },
    onError: (err, vars) => {
      if (vars.silent) return;
      toast.error(`Không lưu được thông tin đối tác: ${err instanceof Error ? err.message : "lỗi không xác định"}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.postingDossier.all }),
  });
}
