import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useDossierItems, useSyncDossierItems } from "@/hooks/useDossierItems";
import { DOSSIER_KIND_LABEL, type DossierKind } from "@/lib/dossier/types";
import { incompleteKinds, type DossierDraft } from "@/lib/dossier/draft";

const sig = (postingId: string, draft: DossierDraft) => `${postingId}|${JSON.stringify(draft)}`;

/**
 * Phần đối tác (pháp lý / đấu giá / thẩm định) của wizard số hoá: nạp các dòng asset_posting_dossier_items để mở lại
 * nháp, và ghi lại SAU mỗi lần lưu hồ sơ (tự lưu, lưu thủ công, hoàn tất) — bảng con cần
 * id hồ sơ nên không ghi cùng lượt với asset_postings.
 *
 * Bỏ qua lượt ghi khi phần dịch vụ không đổi (tự lưu chạy sau mỗi lần gõ).
 */
export function useWizardDossier(openedPostingId: string | null) {
  const rows = useDossierItems(openedPostingId);
  const sync = useSyncDossierItems();
  const mutateRef = useRef(sync.mutateAsync);
  mutateRef.current = sync.mutateAsync;
  const last = useRef<string | null>(null);
  // Không nạp được dòng đã lưu ⇒ KHÔNG ghi: form đang trống sẽ xoá mất dữ liệu thật.
  const broken = !!openedPostingId && rows.isError;
  const brokenRef = useRef(broken);
  brokenRef.current = broken;

  /** Ghi phần dịch vụ. Trả các phần chưa đủ để lưu, hoặc null nếu lỗi / bị chặn. */
  const save = useCallback(
    async (postingId: string, draft: DossierDraft): Promise<DossierKind[] | null> => {
      if (brokenRef.current) return null;
      if (sig(postingId, draft) === last.current) return incompleteKinds(draft);
      try {
        const { incomplete } = await mutateRef.current({ postingId, draft, silent: true });
        last.current = sig(postingId, draft);
        return incomplete;
      } catch {
        return null;
      }
    },
    [],
  );

  /** Hoàn tất: ghi và báo người dùng phần nào chưa vào được hồ sơ. */
  const saveOnFinish = useCallback(
    async (postingId: string, draft: DossierDraft) => {
      const incomplete = await save(postingId, draft);
      if (incomplete === null) {
        toast.error("Chưa lưu được thông tin đối tác. Mở lại hồ sơ để nhập lại.");
      } else if (incomplete.length) {
        const names = incomplete.map((k) => DOSSIER_KIND_LABEL[k]).join(", ");
        toast.warning(`${names}: chưa đủ thông tin nên chưa lưu vào hồ sơ.`);
      }
    },
    [save],
  );

  /** Vừa nạp từ DB — coi như đã đồng bộ, khỏi ghi lại y nguyên. */
  const markSynced = useCallback((postingId: string, draft: DossierDraft) => {
    last.current = sig(postingId, draft);
  }, []);

  const reset = useCallback(() => {
    last.current = null;
  }, []);

  return {
    rows: rows.data ?? [],
    /** Đã có kết quả nạp (thành công hoặc lỗi) — hoặc không có gì để nạp. */
    ready: !openedPostingId || rows.isFetched,
    save,
    saveOnFinish,
    markSynced,
    reset,
  };
}
