import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import type {
  ResolvedContractTerms,
  SupplierContract,
  SupplierContractLine,
  SupplierContractLineUpsert,
  SupplierContractUpsert,
} from "@/types/supplierContract";

// Truy cập qua untyped cast — cùng convention với useSuppliers.ts / useOrders.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
const contractsTable = () => (supabase as any).from("supplier_contracts");
const linesTable = () => (supabase as any).from("supplier_contract_lines");
/* eslint-enable @typescript-eslint/no-explicit-any */

const LINE_SELECT =
  "*, service:services(id,name,kind), variant:service_variants(id,name)";
const CONTRACT_SELECT = `*, lines:supplier_contract_lines(${LINE_SELECT})`;

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Hợp đồng của MỘT đối tác, kèm dòng dịch vụ. */
export function useSupplierContracts(supplierId?: string) {
  return useQuery<SupplierContract[]>({
    queryKey: qk.supplierContracts.bySupplier(supplierId),
    queryFn: async () => {
      const { data, error } = await contractsTable()
        .select(CONTRACT_SELECT)
        .eq("supplier_id", supplierId)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierContract[];
    },
    enabled: !!supplierId,
  });
}

/**
 * Toàn bộ hợp đồng (không kèm dòng) — cho cột "Hợp đồng" ở trang danh sách.
 * Đọc một lượt rồi gom theo supplier ở client thay vì N query song song.
 */
export function useAllSupplierContracts() {
  return useQuery<SupplierContract[]>({
    queryKey: qk.supplierContracts.all,
    queryFn: async () => {
      const { data, error } = await contractsTable()
        .select("*")
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SupplierContract[];
    },
  });
}

/**
 * Điều khoản đang hiệu lực cho (đối tác, dịch vụ, biến thể) tại một ngày.
 *
 * Đi qua RPC `admin_resolve_contract_terms` chứ không tự join ở client: hàm SQL
 * là NƠI DUY NHẤT quyết định "hợp đồng nào thắng" (ưu tiên dòng khớp biến thể,
 * rồi ký sau đè ký trước). Nhân bản luật đó ra TypeScript là cách chắc chắn để
 * form hiện một mức còn đơn lưu một mức khác.
 */
export function useResolvedContractTerms(params: {
  supplierId?: string | null;
  serviceId?: string | null;
  variantId?: string | null;
  /** ISO date 'YYYY-MM-DD'. */
  at?: string | null;
  enabled?: boolean;
}) {
  const { supplierId, serviceId, variantId, at, enabled = true } = params;
  return useQuery<ResolvedContractTerms | null>({
    queryKey: qk.contractTerms(supplierId, serviceId, variantId, at),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc(
        "admin_resolve_contract_terms",
        {
          _supplier_id: supplierId,
          _service_id: serviceId,
          _variant_id: variantId ?? null,
          _at: at ?? new Date().toISOString().slice(0, 10),
        },
      );
      if (error) throw error;
      const rows = (data ?? []) as ResolvedContractTerms[];
      return rows[0] ?? null;
    },
    enabled: enabled && !!supplierId && !!serviceId,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Trigger chống trùng hợp đồng ném check_violation kèm câu tiếng Việt sẵn. */
export function contractErrorMessage(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string };
  const msg = e?.message ?? "";
  if (msg.includes("Trùng hợp đồng")) return msg;
  if (e?.code === "23505") return "Dịch vụ này đã có trong hợp đồng";
  if (e?.code === "23503") return "Không xoá được: còn dữ liệu đang tham chiếu";
  return fallback;
}

function invalidateContracts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  qc: any,
  supplierId?: string | null,
) {
  qc.invalidateQueries({ queryKey: qk.supplierContracts.all });
  if (supplierId) {
    qc.invalidateQueries({ queryKey: qk.supplierContracts.bySupplier(supplierId) });
  }
  // Mức hoa hồng vừa đổi ⇒ mọi ô tra điều khoản đang mở phải đọc lại.
  qc.invalidateQueries({ queryKey: ["contract-terms"] });
}

export function useUpsertContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SupplierContractUpsert) => {
      if (id) {
        const { data, error } = await contractsTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as SupplierContract;
      }
      const { data, error } = await contractsTable().insert(payload).select().single();
      if (error) throw error;
      return data as SupplierContract;
    },
    onSuccess: (data: SupplierContract) => invalidateContracts(qc, data.supplier_id),
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; supplierId: string }) => {
      const { error } = await contractsTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateContracts(qc, vars.supplierId),
  });
}

export function useUpsertContractLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { supplierId: string; line: SupplierContractLineUpsert }) => {
      const { id, ...payload } = vars.line;
      if (id) {
        const { data, error } = await linesTable()
          .update(payload)
          .eq("id", id)
          .select(LINE_SELECT)
          .single();
        if (error) throw error;
        return data as SupplierContractLine;
      }
      const { data, error } = await linesTable()
        .insert(payload)
        .select(LINE_SELECT)
        .single();
      if (error) throw error;
      return data as SupplierContractLine;
    },
    onSuccess: (_data, vars) => invalidateContracts(qc, vars.supplierId),
  });
}

export function useDeleteContractLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; supplierId: string }) => {
      const { error } = await linesTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateContracts(qc, vars.supplierId),
  });
}
