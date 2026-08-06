import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Customer, CustomerUpsert } from "@/types/customers";
import { qk } from "@/lib/queryKeys";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customersTable = () => (supabase as any).from("customers");

// PHẢI chỉ đích danh khoá ngoại: giữa customers và leads có HAI quan hệ
// (customers.source_lead_id → leads.id và leads.converted_customer_id →
// customers.id), PostgREST không tự đoán được và trả PGRST201.
const CUSTOMER_SELECT =
  "*, source_lead:leads!customers_source_lead_id_fkey(id,code,name,source)";

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: qk.customers.all,
    queryFn: async () => {
      const { data, error } = await customersTable()
        .select(CUSTOMER_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
}

export function useCustomer(id?: string) {
  return useQuery<Customer>({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await customersTable()
        .select(CUSTOMER_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Làm mới mọi query phụ thuộc một khách hàng. Gọi cả khi user_id đổi vì tab
 *  Đơn hàng và Chiến dịch đọc theo user_id chứ không theo customer_id. */
function invalidateCustomer(
  qc: ReturnType<typeof useQueryClient>,
  id?: string,
) {
  qc.invalidateQueries({ queryKey: qk.customers.all });
  if (id) qc.invalidateQueries({ queryKey: ["customer", id] });
  qc.invalidateQueries({ queryKey: qk.orders.byCustomerUserAll });
  qc.invalidateQueries({ queryKey: qk.campaignRecipients.byUserAll });
}

export function useUpsertCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: CustomerUpsert) => {
      if (id) {
        const { data, error } = await customersTable()
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Customer;
      }
      const { data, error } = await customersTable().insert(payload).select().single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (data: Customer) => invalidateCustomer(qc, data.id),
  });
}

/** Gắn/gỡ tài khoản trên sàn. Tách khỏi useUpsertCustomer để trang chi tiết đổi
 *  liên kết được mà không phải mở form. */
export function useLinkCustomerUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, userId }: { customerId: string; userId: string | null }) => {
      const { error } = await customersTable()
        .update({ user_id: userId })
        .eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidateCustomer(qc, vars.customerId),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await customersTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.customers.all }),
  });
}

/** Dịch lỗi Postgres sang câu tiếng Việt cụ thể. Mirror leadErrorMessage —
 *  trả null khi không nhận ra để nơi gọi rơi về câu chung. */
export function customerErrorMessage(err: unknown): string | null {
  const e = err as { code?: string; message?: string };
  const msg = e?.message ?? "";
  // idx_customers_user là UNIQUE partial trên user_id.
  if (e?.code === "23505" && msg.includes("idx_customers_user")) {
    return "Tài khoản này đã gắn với khách hàng khác";
  }
  if (e?.code === "23505") return "Dữ liệu bị trùng với một khách hàng khác";
  if (e?.code === "23503") return "Xóa thất bại — còn cơ hội hoặc đơn hàng đang gắn";
  if (msg.includes("Không có quyền")) return "Bạn không có quyền thực hiện thao tác này";
  return null;
}
