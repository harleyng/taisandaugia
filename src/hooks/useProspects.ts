import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AliasSuggestion,
  ProspectDetail,
  ProspectKind,
  ProspectRow,
} from "@/lib/prospects/types";
import { qk } from "@/lib/queryKeys";

// Truy cập qua untyped cast — cùng convention với useLeads.ts / useOrders.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

/** Số liệu tài sản của mọi pháp nhân trên sàn, tra theo `${kind}:${id}`.
 *  Dùng để danh sách lead hiển thị cột "Tài sản" cho lead nguồn dữ liệu sàn mà
 *  không phải denormalise con số vào bảng leads (sẽ lệch khi sàn có tin mới). */
export function useProspectStatsMap() {
  return useQuery<Record<string, ProspectRow>>({
    queryKey: ["admin-prospect-stats"],
    queryFn: async () => {
      const [owners, orgs] = await Promise.all([
        rpc("admin_prospects", { p_kind: "asset_owner", p_limit: 1000, p_offset: 0 }),
        rpc("admin_prospects", { p_kind: "auction_org", p_limit: 1000, p_offset: 0 }),
      ]);
      if (owners.error) throw owners.error;
      if (orgs.error) throw orgs.error;
      const map: Record<string, ProspectRow> = {};
      for (const r of [...(owners.data ?? []), ...(orgs.data ?? [])] as ProspectRow[]) {
        map[`${r.kind}:${r.id}`] = r;
      }
      return map;
    },
    staleTime: 5 * 60_000,
  });
}

/** Đồng bộ prospect → lead thật (source='market_data'). RPC idempotent: chạy lại
 *  chỉ bỏ qua những pháp nhân đã có lead. Dùng useQuery thay vì useMutation để
 *  React Query tự chống gọi trùng khi tab re-render / StrictMode double-mount. */
export function useSyncProspectLeads() {
  const qc = useQueryClient();
  return useQuery<{ created: number; skipped: number; total: number }>({
    queryKey: ["admin-prospect-leads-sync"],
    queryFn: async () => {
      const { data, error } = await rpc("admin_sync_prospect_leads", { p_kind: null });
      if (error) throw error;
      const result = data as { created: number; skipped: number; total: number };
      // Chỉ làm mới danh sách lead khi thật sự có bản ghi mới.
      if (result?.created > 0) {
        qc.invalidateQueries({ queryKey: qk.leads.all });
        qc.invalidateQueries({ queryKey: ["admin-prospect-stats"] });
      }
      return result;
    },
    staleTime: 30 * 60_000,
    retry: false,
  });
}

/** Cơ cấu tài sản chi tiết của một prospect. */
export function useProspectDetail(kind: ProspectKind, id: string | null | undefined) {
  return useQuery<ProspectDetail>({
    queryKey: ["admin-prospect-detail", kind, id],
    queryFn: async () => {
      const { data, error } = await rpc("admin_prospect_detail", { p_kind: kind, p_id: id });
      if (error) throw error;
      return data as ProspectDetail;
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

/** Tìm pháp nhân cùng loại để gán làm chi nhánh. Dùng lại admin_prospects thay
 *  vì viết RPC tìm kiếm riêng — nó đã lọc theo tên chuẩn hoá và trả sẵn số tài
 *  sản để admin chọn đúng đơn vị khi tên gần giống nhau. */
export function useProspectSearch(kind: ProspectKind, search: string, enabled = true) {
  const q = search.trim();
  return useQuery<ProspectRow[]>({
    queryKey: ["admin-prospect-search", kind, q],
    queryFn: async () => {
      const { data, error } = await rpc("admin_prospects", {
        p_kind: kind, p_search: q, p_limit: 20, p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as ProspectRow[];
    },
    enabled: enabled && q.length >= 2,
    staleTime: 60_000,
  });
}

/** Mọi thao tác cơ cấu đều đổi cả công ty mẹ lẫn chi nhánh (branch_count /
 *  parent_name / cụm), nên làm mới chung một chỗ thay vì nhắm từng key. */
function useStructureInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin-prospect-detail"] });
    qc.invalidateQueries({ queryKey: ["admin-prospect-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-prospect-search"] });
  };
}

/** Gán một hoặc nhiều pháp nhân làm chi nhánh của prospect (parentId = null để
 *  gỡ). Quan hệ do admin đặt luôn là 'confirmed' nên suy luận sau không đè lên. */
export function useSetProspectParent() {
  const invalidate = useStructureInvalidate();
  return useMutation({
    mutationFn: async (v: {
      kind: ProspectKind;
      childIds: string[];
      parentId: string | null;
    }) => {
      const { data, error } = await rpc("admin_set_prospect_parents", {
        p_kind: v.kind, p_child_ids: v.childIds, p_parent_id: v.parentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Xếp / gỡ chi nhánh khỏi cụm (groupId = null để gỡ). */
export function useSetProspectGroup() {
  const invalidate = useStructureInvalidate();
  return useMutation({
    mutationFn: async (v: {
      kind: ProspectKind;
      unitIds: string[];
      groupId: string | null;
    }) => {
      const { data, error } = await rpc("admin_set_prospect_group", {
        p_kind: v.kind, p_unit_ids: v.unitIds, p_group_id: v.groupId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Tạo cụm mới, hoặc đổi tên khi truyền groupId. */
export function useUpsertProspectGroup() {
  const invalidate = useStructureInvalidate();
  return useMutation({
    mutationFn: async (v: {
      kind: ProspectKind;
      parentId: string;
      name: string;
      groupId?: string | null;
    }) => {
      const { data, error } = await rpc("admin_upsert_prospect_group", {
        p_kind: v.kind, p_parent_id: v.parentId, p_name: v.name,
        p_group_id: v.groupId ?? null,
      });
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: invalidate,
  });
}

/** Xoá cụm — thành viên rơi về "chưa xếp cụm", KHÔNG mất quan hệ với công ty mẹ. */
export function useDeleteProspectGroup() {
  const invalidate = useStructureInvalidate();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data, error } = await rpc("admin_delete_prospect_group", { p_group_id: groupId });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/** Gợi ý alias từ tên tổ chức — dùng ở Tier-1 KYC và ở portal chủ tài sản.
 *  Không cần quyền admin, chỉ cần đăng nhập. */
export function useAliasSuggestion(orgName: string, enabled = true) {
  const name = orgName.trim();
  return useQuery<AliasSuggestion>({
    queryKey: ["org-alias-suggestion", name],
    queryFn: async () => {
      const { data, error } = await rpc("suggest_org_aliases", { p_name: name });
      if (error) throw error;
      return data as AliasSuggestion;
    },
    enabled: enabled && name.length >= 5,
    staleTime: 10 * 60_000,
  });
}
