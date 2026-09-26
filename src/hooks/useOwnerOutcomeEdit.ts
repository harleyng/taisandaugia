import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { qk } from "@/lib/queryKeys";
import {
  OWNER_EVIDENCE_BUCKET,
  evidenceObjectPath,
  outcomeErrorMessage,
  toOutcomeInsert,
  type OffPlatformOutcomeTarget,
  type ReportOutcomeForm,
} from "@/lib/ownerOutcomeReport";
import { toOutcomeUpdate, type OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";

/**
 * Làm mới mọi thứ đọc từ owner_asset_outcomes: giá trúng hợp nhất + "Kết quả
 * phiên" + lịch sử lượt (cùng prefix ownerAssetOutcomes), số lượt đã khai, và số
 * "Đã thu" / "Chờ thu tiền" của Nhịp đập + Chỉ tiêu.
 */
export function invalidateOwnerOutcomes(queryClient: QueryClient, workspaceId: string | null | undefined) {
  void queryClient.invalidateQueries({ queryKey: qk.ownerAssetOutcomes(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: qk.ownerOutcomeRounds(workspaceId).slice(0, 2) });
  void queryClient.invalidateQueries({ queryKey: qk.ownerOutcomePayments(workspaceId) });
}

/** Xem biên bản (bucket private): link ký 5 phút. */
export async function outcomeEvidenceUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(OWNER_EVIDENCE_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error("no_url");
  return data.signedUrl;
}

/** Tải biên bản vào {workspace}/{outcome}/ rồi gắn vào bản ghi; thay thì xoá tệp cũ SAU khi gắn xong. */
async function attachEvidence(workspaceId: string, outcomeId: string, file: File, replaces: string[]): Promise<boolean> {
  const bucket = supabase.storage.from(OWNER_EVIDENCE_BUCKET);
  const path = evidenceObjectPath(workspaceId, outcomeId, file.name);
  const upload = await bucket.upload(path, file, { upsert: false, contentType: file.type });
  if (upload.error) return false;
  const attach = await supabase.from("owner_asset_outcomes").update({ evidence_urls: [path] }).eq("id", outcomeId);
  if (attach.error) {
    await bucket.remove([path]);
    return false;
  }
  if (replaces.length) await bucket.remove(replaces);
  return true;
}

export type SaveOwnerOutcomeInput =
  | { mode: "create"; form: ReportOutcomeForm; target: OffPlatformOutcomeTarget; evidence: File | null }
  | { mode: "update"; form: ReportOutcomeForm; record: OwnerOutcomeRecord; evidence: File | null };

/**
 * Khai tài sản NGOÀI sàn (create) hoặc sửa một lượt đã khai (update). Tài sản trên
 * sàn khai mới vẫn đi qua useReportOwnerOutcome của Phase 6.
 * Thứ tự biên bản giữ như Phase 6: bản ghi → tệp → gắn đường dẫn.
 */
export function useSaveOwnerOutcome(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  return useMutation({
    mutationFn: async (input: SaveOwnerOutcomeInput) => {
      if (!workspaceId || !userId) throw new Error("no_workspace");
      let id: string;
      let replaces: string[] = [];
      if (input.mode === "create") {
        id = crypto.randomUUID();
        const { error } = await supabase
          .from("owner_asset_outcomes")
          .insert(toOutcomeInsert(input.form, { id, workspaceId, target: input.target, reportedBy: userId }));
        if (error) throw error;
      } else {
        id = input.record.id;
        replaces = input.record.evidence_urls;
        const { data, error } = await supabase
          .from("owner_asset_outcomes")
          .update(toOutcomeUpdate(input.form, input.record))
          .eq("id", id)
          .select("id");
        if (error) throw error;
        // RLS lọc mất dòng (ngoài phạm vi chi nhánh) thì UPDATE "thành công" với 0 dòng.
        if (!data?.length) throw Object.assign(new Error("not_authorized"), { code: "42501" });
      }
      if (!input.evidence) return { evidenceFailed: false, mode: input.mode };
      const ok = await attachEvidence(workspaceId, id, input.evidence, replaces);
      return { evidenceFailed: !ok, mode: input.mode };
    },
    onSuccess: ({ evidenceFailed, mode }) => {
      if (evidenceFailed) toast.warning("Đã lưu kết quả, nhưng chưa đính kèm được biên bản. Vui lòng thử lại sau.");
      else toast.success(mode === "create" ? "Đã khai kết quả phiên" : "Đã cập nhật lượt đấu giá");
    },
    onError: (err, input) => toast.error(outcomeErrorMessage(err, Number(input.form.roundNo))),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}

/** Xoá một lượt: xoá TỆP trước (policy storage cần bản ghi còn tồn tại), rồi mới xoá dòng. */
export function useDeleteOwnerOutcome(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: OwnerOutcomeRecord) => {
      if (record.evidence_urls.length) {
        const { error } = await supabase.storage.from(OWNER_EVIDENCE_BUCKET).remove(record.evidence_urls);
        if (error) throw error;
      }
      const { data, error } = await supabase.from("owner_asset_outcomes").delete().eq("id", record.id).select("id");
      if (error) throw error;
      if (!data?.length) throw Object.assign(new Error("not_authorized"), { code: "42501" });
    },
    onSuccess: () => toast.success("Đã xoá lượt đấu giá"),
    onError: (err) =>
      toast.error(
        (err as { code?: string })?.code === "42501"
          ? "Bạn không có quyền xoá lượt này (ngoài phạm vi chi nhánh của bạn)."
          : "Không xoá được lượt này. Vui lòng thử lại.",
      ),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}
